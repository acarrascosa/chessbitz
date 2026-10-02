import { describe, expect, it } from 'vitest';
import { encryptPayload, fromBase64Url, importServerKeys, parseSubscription, toBase64Url, tokenHash, vapidAuthorization } from '../worker/push';
import { pushText } from '../src/lib/push';

describe('web push encryption (RFC 8291)', () => {
    it('matches the RFC\'s example byte for byte', async () => {
        const keys = await importServerKeys(
            'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
            'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
        );
        const body = await encryptPayload(
            new TextEncoder().encode('When I grow up, I want to be a watermelon'),
            'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
            'BTBZMqHH6r4Tts7J_aSIgg',
            { salt: fromBase64Url('DGv6ra1nlYgDCS1FRnbzlw'), keys },
        );
        // The request body of the RFC's section 5 (header and ciphertext of appendix A).
        expect(toBase64Url(body)).toBe(
            'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml'
            + 'mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT'
            + 'pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
        );
        // 86-byte header + 41 bytes of text, the delimiter and the 16-byte tag (the RFC's Content-Length says 145, its body is 144).
        expect(body.length).toBe(144);
    });

    it('signs a VAPID JWT for the push service\'s origin, verifiable with the public key', async () => {
        const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
        const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey) as ArrayBuffer);
        const { d } = await crypto.subtle.exportKey('jwk', pair.privateKey);
        const header = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', toBase64Url(publicRaw), d!, 'https://chessbitz.com', 1_800_000_000_000);
        const [, jwt, key] = header.match(/^vapid t=([^,]+), k=(.+)$/)!;
        expect(key).toBe(toBase64Url(publicRaw));
        const [h, c, s] = jwt.split('.');
        expect(JSON.parse(new TextDecoder().decode(fromBase64Url(c)))).toEqual({ aud: 'https://fcm.googleapis.com', exp: 1_800_000_000 + 12 * 3600, sub: 'https://chessbitz.com' });
        const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, fromBase64Url(s), new TextEncoder().encode(`${h}.${c}`));
        expect(valid).toBe(true);
    });
});

describe('push subscriptions', () => {
    const keys = { p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcx', auth: 'BTBZMqHH6r4Tts7J_aSIgg' };
    const body = (endpoint: string, extra: object = {}) => ({ subscription: { endpoint, keys }, topics: ['match', 'daily', 'spam'], lang: 'en', ...extra });

    it('accepts browsers\' push services and keeps only known topics', () => {
        expect(parseSubscription(body('https://fcm.googleapis.com/fcm/send/xyz', { token: 'abcdefghijklmnopqrstuvwx' }))).toEqual({
            endpoint: 'https://fcm.googleapis.com/fcm/send/xyz', ...keys, lang: 'en', topics: ['daily', 'match'], token: 'abcdefghijklmnopqrstuvwx',
        });
        expect(parseSubscription(body('https://updates.push.services.mozilla.com/wpush/v2/x'))?.token).toBeNull();
        expect(parseSubscription(body('https://web.push.apple.com/abc'))).not.toBeNull();
    });

    it('refuses anything the Worker shouldn\'t be posting to', () => {
        expect(parseSubscription(body('https://evil.example/fcm.googleapis.com'))).toBeNull();
        expect(parseSubscription(body('http://fcm.googleapis.com/fcm/send/xyz'))).toBeNull();
        expect(parseSubscription(body('https://fcm.googleapis.com.evil.example/x'))).toBeNull();
        expect(parseSubscription({ subscription: { endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'short', auth: '!!' } } })).toBeNull();
        expect(parseSubscription(null)).toBeNull();
    });

    it('keeps only a hash of the battle token, the same for the same token', async () => {
        const hash = await tokenHash('abcdefghijklmnopqrstuvwx');
        expect(hash).toHaveLength(32);
        expect(hash).not.toContain('abcdefgh');
        expect(await tokenHash('abcdefghijklmnopqrstuvwx')).toBe(hash);
        expect(await tokenHash('abcdefghijklmnopqrstuvwy')).not.toBe(hash);
    });

    it('has a message per topic and language that opens the right page', () => {
        expect(pushText('es', 'match')).toMatchObject({ url: '/batalla/?buscar=1', ttl: 300, tag: 'chessbitz-match' });
        expect(pushText('en', 'daily').url).toBe('/en/');
    });
});
