import { Database } from "bun:sqlite";
import { beforeAll, describe, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { drizzle as drizzleSqlite } from "drizzle-orm/bun-sqlite";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { TrackingEvent } from "@unifeather/core";
import { CREATE_TABLE_SQL, sqlAdapter } from "../src/adapters/sql.js";

const base = Date.UTC(2026, 6, 10, 12, 0, 0);
const day = 86_400_000;

const client = new PGlite();
const db = drizzle(client);

const event = (i: number, path: string, tsOffset: number, userId?: string): TrackingEvent => ({
  eventId: `e${i}`,
  name: "pageview",
  timestamp: base + tsOffset,
  hostname: "site.example",
  path,
  referrerHost: i % 2 ? "google.com" : undefined,
  language: "de-DE",
  activeSeconds: 30,
  browserName: "Chrome",
  osName: "macOS",
  screenWidth: 1440,
  screenHeight: 900,
  country: "DE",
  userId,
  properties: { plan: "pro" },
});

beforeAll(async () => {
  await client.exec(CREATE_TABLE_SQL);
  const adapter = sqlAdapter({ db, sampling: { enabled: false } });
  const rows = [
    event(1, "/pricing", 0, "u1"),
    event(2, "/pricing", 60_000, "u1"),
    event(3, "/pricing", day, "u2"),
    event(4, "/home", 120_000, "u2"),
    event(5, "/home", day + 60_000),
    event(6, "/about", 5_000),
  ];
  for (const e of rows) await adapter.insert(e);
});

describe("sqlAdapter.stats (Postgres via pglite)", () => {
  test("aggregates views, distinct visitors, top pages, referrers and timeseries", async () => {
    const adapter = sqlAdapter({ db, sampling: { enabled: false } });
    const res = await adapter.stats({ from: base - day, to: base + 3 * day, interval: "day", limit: 10 });

    expect(res.totals.views).toBe(6);
    expect(res.totals.visitors).toBe(2); // distinct user_id u1,u2 (nulls ignored)
    expect(res.totals.avgActiveSeconds).toBe(30);
    expect(res.topPages[0]).toEqual({ path: "/pricing", views: 3 });
    expect(res.topPages[1]!.views).toBe(2);
    expect(res.topReferrers[0]!.referrer).toBe("google.com");
    expect(res.timeseries).toEqual([
      { date: "2026-07-10", views: 4 },
      { date: "2026-07-11", views: 2 },
    ]);
    expect(res.sampled).toBe(false);
  });

  test("query-side sampling path runs and reports its rate", async () => {
    // threshold -1 forces the TABLESAMPLE branch on any table size.
    const adapter = sqlAdapter({ db, sampling: { enabled: true, threshold: -1, rate: 0.5 } });
    const res = await adapter.stats({ from: base - day, to: base + 3 * day });
    expect(res.sampled).toBe(true);
    expect(res.sampleRate).toBe(0.5);
    // Distinct visitors are not extrapolated from a sample.
    expect(res.totals.visitors).toBeUndefined();
    expect(typeof res.totals.views).toBe("number");
  });
});

// Same adapter, different dialect: proves the query builder + random-order
// sampling path is portable beyond Postgres (SQLite here, MySQL by analogy).
const sqliteEvents = sqliteTable("unifeather_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: text("event_id").notNull(),
  name: text("name").notNull(),
  ts: integer("ts", { mode: "timestamp" }).notNull(),
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
  properties: text("properties", { mode: "json" }),
});

const sqlite = new Database(":memory:");
const sqliteDb = drizzleSqlite(sqlite);

describe("sqlAdapter.stats (SQLite via bun:sqlite)", () => {
  beforeAll(async () => {
    sqlite.exec(`CREATE TABLE unifeather_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL, name TEXT NOT NULL, ts INTEGER NOT NULL,
      hostname TEXT NOT NULL, path TEXT NOT NULL, referrer_host TEXT, language TEXT,
      active_seconds INTEGER NOT NULL DEFAULT 0, browser_name TEXT, browser_version TEXT,
      os_name TEXT, os_version TEXT, screen_width INTEGER, screen_height INTEGER,
      country TEXT, user_id TEXT, session_id TEXT, properties TEXT
    )`);
    const adapter = sqlAdapter({ db: sqliteDb, table: sqliteEvents, dialect: "sqlite", sampling: { enabled: false } });
    const rows = [
      event(1, "/pricing", 0, "u1"),
      event(2, "/pricing", 60_000, "u1"),
      event(3, "/pricing", day, "u2"),
      event(4, "/home", 120_000, "u2"),
      event(5, "/home", day + 60_000),
      event(6, "/about", 5_000),
    ];
    for (const e of rows) await adapter.insert(e);
  });

  test("aggregates the same via the query builder as Postgres", async () => {
    const adapter = sqlAdapter({ db: sqliteDb, table: sqliteEvents, dialect: "sqlite", sampling: { enabled: false } });
    const res = await adapter.stats({ from: base - day, to: base + 3 * day, interval: "day", limit: 10 });

    expect(res.totals.views).toBe(6);
    expect(res.totals.visitors).toBe(2);
    expect(res.totals.avgActiveSeconds).toBe(30);
    expect(res.topPages[0]).toEqual({ path: "/pricing", views: 3 });
    expect(res.topReferrers[0]!.referrer).toBe("google.com");
    expect(res.timeseries).toEqual([
      { date: "2026-07-10", views: 4 },
      { date: "2026-07-11", views: 2 },
    ]);
    expect(res.sampled).toBe(false);
  });

  test("random-order + limit sampling path runs and extrapolates", async () => {
    // threshold -1 forces the ORDER BY random() LIMIT branch on any table size.
    const adapter = sqlAdapter({ db: sqliteDb, table: sqliteEvents, dialect: "sqlite", sampling: { enabled: true, threshold: -1, rate: 0.5 } });
    const res = await adapter.stats({ from: base - day, to: base + 3 * day });
    expect(res.sampled).toBe(true);
    expect(res.sampleRate).toBe(0.5);
    // 6 rows × 0.5 → sample of 3, scaled ×2 back to 6.
    expect(res.totals.views).toBe(6);
    // Distinct visitors are not extrapolated from a sample.
    expect(res.totals.visitors).toBeUndefined();
  });
});
