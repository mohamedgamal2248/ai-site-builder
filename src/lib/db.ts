import postgres from "postgres";

export type Sql = postgres.Sql;

let client: Sql | null | undefined;

/**
 * Postgres connection for statistics, or null when DATABASE_URL is not set
 * (the explorer pages still work; the statistics pages say they are not set up).
 * With Supabase, use the pooler URL (port 6543); prepared statements are off for it.
 */
export function getDb(): Sql | null {
  if (client !== undefined) return client;
  const url = process.env.DATABASE_URL;
  client = url
    ? postgres(url, {
        max: Number(process.env.DATABASE_POOL_MAX || 3),
        prepare: false,
        idle_timeout: 20,
        connect_timeout: 10,
        ssl: /localhost|127\.0\.0\.1|host=\/|@\/|\?host=/.test(url) ? false : "require",
      })
    : null;
  return client;
}

/** Test hook. */
export function setDb(sql: Sql | null) {
  client = sql;
}
