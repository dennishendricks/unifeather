import type {
  Adapter,
  CountedPath,
  CountedReferrer,
  StatsQuery,
  StatsResult,
  TimeseriesPoint,
  TrackingEvent,
} from "@unifeather/core";

/** Minimal shape of the Analytics Engine Workers binding (`env.<NAME>`). */
export interface AnalyticsEngineDataset {
  writeDataPoint(point: {
    indexes?: string[];
    blobs?: (string | null)[];
    doubles?: number[];
  }): void;
}

export interface AnalyticsEngineOptions {
  /** The Workers binding used for ingestion (`env.AE`). Required to `insert`. */
  readonly dataset?: AnalyticsEngineDataset;
  /** Cloudflare account id — required for `stats` (the SQL API). */
  readonly accountId?: string;
  /** API token with Analytics read permission — required for `stats`. */
  readonly apiToken?: string;
  /** The dataset name as referenced in SQL (the wrangler `dataset` value). */
  readonly datasetName?: string;
}

// Stable blob/double column layout — DO NOT reorder, queries depend on it.
const BLOBS = [
  "name", // blob1
  "path", // blob2
  "hostname", // blob3
  "referrerHost", // blob4
  "language", // blob5
  "browserName", // blob6
  "browserVersion", // blob7
  "osName", // blob8
  "osVersion", // blob9
  "country", // blob10
  "userId", // blob11
  "sessionId", // blob12
] as const satisfies readonly (keyof TrackingEvent)[];

const SQL_URL = (accountId: string): string =>
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`;

interface SqlResponse<T> {
  readonly data: readonly T[];
}

/**
 * Cloudflare Analytics Engine adapter. Ingestion is cheap and unlimited via the
 * Workers binding; querying uses the SQL API. Analytics Engine applies adaptive
 * sampling automatically and stores `_sample_interval` per row, so all counts
 * are `SUM(_sample_interval)` to extrapolate back to true totals.
 */
export const analyticsEngineAdapter = (options: AnalyticsEngineOptions): Adapter => {
  const insert = async (event: TrackingEvent): Promise<void> => {
    if (!options.dataset) throw new Error("analyticsEngineAdapter: `dataset` binding required to insert");
    options.dataset.writeDataPoint({
      indexes: [event.path], // sampling key
      blobs: BLOBS.map((key) => {
        const value = event[key];
        return value == null ? null : String(value);
      }),
      doubles: [event.activeSeconds, event.screenWidth ?? 0, event.screenHeight ?? 0],
    });
  };

  const runSql = async <T>(sql: string): Promise<readonly T[]> => {
    const { accountId, apiToken } = options;
    if (!accountId || !apiToken) {
      throw new Error("analyticsEngineAdapter: `accountId` and `apiToken` required for stats");
    }
    const res = await fetch(SQL_URL(accountId), {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "text/plain" },
      body: sql,
    });
    if (!res.ok) throw new Error(`Analytics Engine SQL error ${res.status}: ${await res.text()}`);
    return ((await res.json()) as SqlResponse<T>).data;
  };

  const stats = async (query: StatsQuery): Promise<StatsResult> => {
    const table = options.datasetName;
    if (!table) throw new Error("analyticsEngineAdapter: `datasetName` required for stats");

    const fromSec = Math.floor(query.from / 1000);
    const toSec = Math.floor(query.to / 1000);
    const limit = query.limit ?? 10;
    const unit = query.interval === "hour" ? "1 HOUR" : "1 DAY";
    const where = `timestamp >= toDateTime(${fromSec}) AND timestamp < toDateTime(${toSec}) AND blob1 = 'pageview'`;

    const [totals, pages, referrers, series] = await Promise.all([
      runSql<{ views: number; visitors: number; avgActive: number }>(
        // visitors = distinct user ids (blob11); requires the cookieId/userId tracker option.
        `SELECT SUM(_sample_interval) AS views, COUNT(DISTINCT blob11) AS visitors, AVG(double1) AS avgActive FROM ${table} WHERE ${where}`,
      ),
      runSql<CountedPath>(
        `SELECT blob2 AS path, SUM(_sample_interval) AS views FROM ${table} WHERE ${where} GROUP BY path ORDER BY views DESC LIMIT ${limit}`,
      ),
      runSql<CountedReferrer>(
        `SELECT blob4 AS referrer, SUM(_sample_interval) AS views FROM ${table} WHERE ${where} AND blob4 != '' GROUP BY referrer ORDER BY views DESC LIMIT ${limit}`,
      ),
      runSql<{ bucket: string; views: number }>(
        `SELECT toStartOfInterval(timestamp, INTERVAL ${unit}) AS bucket, SUM(_sample_interval) AS views FROM ${table} WHERE ${where} GROUP BY bucket ORDER BY bucket ASC`,
      ),
    ]);

    const total = totals[0];
    const timeseries: TimeseriesPoint[] = series.map((row) => ({
      date: row.bucket,
      views: Number(row.views),
    }));

    return {
      totals: {
        views: Number(total?.views ?? 0),
        visitors: total?.visitors ? Number(total.visitors) : undefined,
        avgActiveSeconds: total?.avgActive ? Math.round(Number(total.avgActive)) : undefined,
      },
      topPages: pages.map((p) => ({ path: p.path, views: Number(p.views) })),
      topReferrers: referrers.map((r) => ({ referrer: r.referrer, views: Number(r.views) })),
      timeseries,
      // Analytics Engine samples adaptively; counts are already extrapolated.
      sampled: true,
    };
  };

  return { insert, stats };
};
