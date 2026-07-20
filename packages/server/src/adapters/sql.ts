import { and, avg, count, countDistinct, desc, eq, gte, isNotNull, lt, sql, type SQL } from "drizzle-orm";
import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import type { Adapter, StatsQuery, StatsResult, TrackingEvent } from "@unifeather/core";

/**
 * Drizzle table definition for the events table. Use it with drizzle-kit to
 * generate migrations, or run {@link CREATE_TABLE_SQL} directly.
 *
 * Postgres-first (works with node-postgres, Neon, pglite, Supabase, Timescale).
 * For SQLite/D1/MySQL, mirror these columns with the matching drizzle core and
 * pass your table + the right `dialect` to {@link sqlAdapter}.
 */
export const unifeatherEvents = pgTable("unifeather_events", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").notNull(),
  name: text("name").notNull(),
  ts: timestamp("ts", { withTimezone: true }).notNull(),
  hostname: text("hostname").notNull(),
  path: text("path").notNull(),
  referrerHost: text("referrer_host"),
  language: text("language"),
  activeSeconds: integer("active_seconds").notNull().default(0),
  browserName: text("browser_name"),
  browserVersion: text("browser_version"),
  osName: text("os_name"),
  osVersion: text("os_version"),
  screenWidth: integer("screen_width"),
  screenHeight: integer("screen_height"),
  country: text("country"),
  userId: text("user_id"),
  sessionId: text("session_id"),
  properties: jsonb("properties"),
});

/** Ready-to-run DDL for the events table (Postgres). */
export const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS unifeather_events (
  id             BIGSERIAL PRIMARY KEY,
  event_id       TEXT NOT NULL,
  name           TEXT NOT NULL,
  ts             TIMESTAMPTZ NOT NULL,
  hostname       TEXT NOT NULL,
  path           TEXT NOT NULL,
  referrer_host  TEXT,
  language       TEXT,
  active_seconds INTEGER NOT NULL DEFAULT 0,
  browser_name   TEXT,
  browser_version TEXT,
  os_name        TEXT,
  os_version     TEXT,
  screen_width   INTEGER,
  screen_height  INTEGER,
  country        TEXT,
  user_id        TEXT,
  session_id     TEXT,
  properties     JSONB
);
CREATE INDEX IF NOT EXISTS unifeather_events_ts_idx ON unifeather_events (ts);
CREATE INDEX IF NOT EXISTS unifeather_events_path_ts_idx ON unifeather_events (path, ts);
`;

/** SQL dialect of the drizzle `db` — selects the timeseries date-bucket and random-order syntax. */
export type SqlDialect = "pg" | "sqlite" | "mysql";

/** Query-side sampling — extrapolate from a sample on very large tables. */
export interface SamplingOptions {
  /** Enable sampling. Defaults to true. */
  readonly enabled?: boolean;
  /** Row-estimate above which sampling kicks in. Defaults to 1,000,000. */
  readonly threshold?: number;
  /** Fraction of rows to scan when sampling (0–1). Defaults to 0.1 (10%). */
  readonly rate?: number;
}

/**
 * Any drizzle db exposing the query builder + insert. Typed loosely on purpose:
 * the builder API (`select`/`insert`/`from`/`where`/`groupBy`/…) is identical
 * across dialects, but drizzle does not unify the per-dialect db classes.
 */
export interface DrizzleLike {
  select(...args: unknown[]): any;
  insert(...args: unknown[]): any;
}

/** The event columns the queries reference — satisfied by {@link unifeatherEvents} and any mirror table. */
interface EventColumns {
  ts: any;
  name: any;
  path: any;
  referrerHost: any;
  activeSeconds: any;
  userId: any;
}

export interface SqlAdapterOptions {
  readonly db: DrizzleLike;
  /** Drizzle table object for events. Defaults to the built-in Postgres {@link unifeatherEvents}. */
  readonly table?: unknown;
  /** DB dialect — selects date-bucket + random-order SQL. Defaults to "pg". */
  readonly dialect?: SqlDialect;
  readonly sampling?: SamplingOptions;
}

const num = (value: unknown): number => Number(value ?? 0);

/** Random-order expression per dialect (Postgres/SQLite: random(); MySQL: rand()). */
const randomOrder = (dialect: SqlDialect): SQL => (dialect === "mysql" ? sql`rand()` : sql`random()`);

/**
 * Dialect-specific date-bucket label for the timeseries. Drizzle's query builder
 * doesn't abstract date truncation, so this is the one hand-written bit per dialect.
 * SQLite assumes `ts` is an integer unix-seconds column (drizzle `mode: "timestamp"`).
 */
const dateBucket = (dialect: SqlDialect, bucket: "day" | "hour", ts: unknown): SQL => {
  if (dialect === "pg") {
    const fmt = bucket === "hour" ? 'YYYY-MM-DD"T"HH24:00' : "YYYY-MM-DD";
    return sql`to_char(date_trunc(${bucket}, ${ts}), ${fmt})`;
  }
  const fmt = bucket === "hour" ? "%Y-%m-%dT%H:00" : "%Y-%m-%d";
  return dialect === "mysql" ? sql`date_format(${ts}, ${fmt})` : sql`strftime(${fmt}, ${ts}, 'unixepoch')`;
};

/**
 * Universal SQL adapter backed by Drizzle's query builder — one code path for
 * every dialect drizzle supports. Pass the matching drizzle db, table object and
 * `dialect`; only the date-bucket and random-order snippets vary per dialect.
 *
 * On tables past the configured threshold, aggregations run against a portable
 * `ORDER BY random()/rand() LIMIT n` sample and counts are scaled back up. The
 * sample size itself comes from a size estimate: Postgres uses a cheap
 * `TABLESAMPLE SYSTEM (1)` page sample to avoid a full `count`; other dialects
 * count the range directly. (TABLESAMPLE can't back the aggregation itself — a
 * raw-SQL `FROM` is incompatible with the builder's typed column selection.)
 */
export const sqlAdapter = (options: SqlAdapterOptions): Adapter => {
  const { db } = options;
  const dialect = options.dialect ?? "pg";
  const events = options.table ?? unifeatherEvents;
  const table = events as EventColumns;
  const enabled = options.sampling?.enabled ?? true;
  const threshold = options.sampling?.threshold ?? 1_000_000;
  const rate = Math.min(Math.max(options.sampling?.rate ?? 0.1, 0.0001), 1);

  const insert = async (e: TrackingEvent): Promise<void> => {
    await db.insert(events).values({
      eventId: e.eventId,
      name: e.name,
      ts: new Date(e.timestamp),
      hostname: e.hostname,
      path: e.path,
      referrerHost: e.referrerHost ?? null,
      language: e.language ?? null,
      activeSeconds: e.activeSeconds,
      browserName: e.browserName ?? null,
      browserVersion: e.browserVersion ?? null,
      osName: e.osName ?? null,
      osVersion: e.osVersion ?? null,
      screenWidth: e.screenWidth ?? null,
      screenHeight: e.screenHeight ?? null,
      country: e.country ?? null,
      userId: e.userId ?? null,
      sessionId: e.sessionId ?? null,
      properties: e.properties ?? null,
    });
  };

  const stats = async (query: StatsQuery): Promise<StatsResult> => {
    const limit = query.limit ?? 10;
    const bucket = query.interval === "hour" ? "hour" : "day";
    const range = and(
      gte(table.ts, new Date(query.from)),
      lt(table.ts, new Date(query.to)),
      eq(table.name, "pageview"),
    );

    // Decide whether to sample, then pick the source + column base to aggregate over.
    let sampled = false;
    let scale = 1;
    let source: unknown = events;
    let cols: EventColumns = table;
    let where: SQL | undefined = range;

    if (enabled) {
      // Estimate the range size. Postgres uses a cheap 1% page sample; other
      // dialects count the range directly (no portable page-sampling).
      const size =
        dialect === "pg"
          ? num(
              (await db.select({ n: sql<number>`count(*)::float8 * 100` }).from(sql`${events} TABLESAMPLE SYSTEM (1)`).where(range))[0]?.n,
            )
          : num((await db.select({ total: count() }).from(events).where(range))[0]?.total);

      if (size > threshold) {
        sampled = true;
        const n = Math.max(1, Math.round(size * rate));
        const sub = db.select().from(events).where(range).orderBy(randomOrder(dialect)).limit(n).as("uf_sample");
        source = sub;
        cols = sub as EventColumns;
        where = undefined; // range already applied inside the subquery
        scale = size / n;
      }
    }

    const scaled = (value: unknown): number => Math.round(num(value) * scale);
    const bucketExpr = dateBucket(dialect, bucket, cols.ts);

    const [totalsRes, pagesRes, referrersRes, seriesRes] = await Promise.all([
      db
        .select({ views: count(), avgActive: avg(cols.activeSeconds), visitors: countDistinct(cols.userId) })
        .from(source)
        .where(where),
      db.select({ path: cols.path, views: count() }).from(source).where(where).groupBy(cols.path).orderBy(desc(count())).limit(limit),
      db
        .select({ referrer: cols.referrerHost, views: count() })
        .from(source)
        .where(and(where, isNotNull(cols.referrerHost)))
        .groupBy(cols.referrerHost)
        .orderBy(desc(count()))
        .limit(limit),
      // Group/order by ordinal: the bucket expression renders differently in
      // SELECT vs GROUP BY, so referencing it by position keeps them identical.
      db.select({ date: bucketExpr, views: count() }).from(source).where(where).groupBy(sql`1`).orderBy(sql`1`),
    ]);

    const totals = totalsRes[0] ?? {};

    return {
      totals: {
        views: scaled(totals.views),
        // Distinct visitors = distinct user ids; requires the cookieId/userId
        // tracker option. Undefined without identified visitors, or when
        // sampling (distinct counts don't extrapolate from a sample).
        visitors: sampled || !num(totals.visitors) ? undefined : num(totals.visitors),
        avgActiveSeconds: totals.avgActive != null ? Math.round(num(totals.avgActive)) : undefined,
      },
      topPages: pagesRes.map((r: Record<string, unknown>) => ({ path: String(r.path), views: scaled(r.views) })),
      topReferrers: referrersRes.map((r: Record<string, unknown>) => ({
        referrer: String(r.referrer),
        views: scaled(r.views),
      })),
      timeseries: seriesRes.map((r: Record<string, unknown>) => ({ date: String(r.date), views: scaled(r.views) })),
      sampled,
      sampleRate: sampled ? rate : undefined,
    };
  };

  return { insert, stats };
};
