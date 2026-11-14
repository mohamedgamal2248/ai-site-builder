/** Reads configuration from the environment. Every value is optional at import time so tests and local runs work. */
export const env = {
  get appUrl(): string {
    return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  },
  get linkSecret(): string {
    const v = process.env.LINK_SIGNING_SECRET;
    if (v) return v;
    if (process.env.NODE_ENV === "production") throw new Error("LINK_SIGNING_SECRET is not set");
    return "dev-only-link-secret-change-me";
  },
  get tokenKey(): string | undefined {
    return process.env.TOKEN_ENCRYPTION_KEY;
  },
  get cronSecret(): string | undefined {
    return process.env.CRON_SECRET;
  },
  get supabaseUrl(): string | undefined {
    return process.env.SUPABASE_URL;
  },
  get supabaseServiceKey(): string | undefined {
    return process.env.SUPABASE_SERVICE_ROLE_KEY;
  },
  get sallaWebhookSecret(): string | undefined {
    return process.env.SALLA_WEBHOOK_SECRET;
  },
  get sallaClientId(): string | undefined {
    return process.env.SALLA_CLIENT_ID;
  },
  get sallaClientSecret(): string | undefined {
    return process.env.SALLA_CLIENT_SECRET;
  },
  get zidClientId(): string | undefined {
    return process.env.ZID_CLIENT_ID;
  },
  get zidClientSecret(): string | undefined {
    return process.env.ZID_CLIENT_SECRET;
  },
  get zidWebhookSecret(): string | undefined {
    return process.env.ZID_WEBHOOK_SECRET;
  },
  /** How long a checkout link stays valid. */
  linkTtlSeconds: 7 * 24 * 3600,
  /** Window for "probable" attribution of an order to a click on the same product. */
  attributionWindowHours: 48,
};
