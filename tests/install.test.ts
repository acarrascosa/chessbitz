import { describe, expect, it } from 'vitest';
import { isAppleMobile } from '../src/lib/install';

describe('isAppleMobile', () => {
    it('spots iPhones and iPads, including iPads that report a Mac', () => {
        expect(isAppleMobile('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe(true);
        expect(isAppleMobile('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);
        expect(isAppleMobile('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
        expect(isAppleMobile('Mozilla/5.0 (Linux; Android 15; Pixel 7)', 5)).toBe(false);
    });
});
