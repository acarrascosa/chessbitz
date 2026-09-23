export interface Env {
    ASSETS: Fetcher;
    DB: D1Database;
    BATTLE: DurableObjectNamespace;
    RESULTS_LIMITER?: RateLimit;
    BATTLE_LIMITER?: RateLimit;
    /** Discord Activity (all optional: without them the /api/discord routes answer 503). Public. */
    DISCORD_CLIENT_ID?: string;
    /** Public key of the Discord application, to verify interactions. */
    DISCORD_PUBLIC_KEY?: string;
    /** Secret: OAuth2 code exchange, and the key that signs players' sessions. */
    DISCORD_CLIENT_SECRET?: string;
    /** Secret: the bot that posts results and reminders and checks activity instances. */
    DISCORD_BOT_TOKEN?: string;
    /** "1" in .dev.vars only: a fake Discord for local testing (only on localhost). */
    DISCORD_MOCK?: string;
}
