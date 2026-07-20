import type { TrackingEvent } from "./event.js";

/** Time-bucket granularity for the stats timeseries. */
export type Interval = "hour" | "day";

/** Parameters for an aggregated stats query. */
export interface StatsQuery {
  /** Inclusive lower bound, milliseconds since epoch. */
  readonly from: number;
  /** Exclusive upper bound, milliseconds since epoch. */
  readonly to: number;
  /** Max rows for top-N lists (pages, referrers). Defaults to 10. */
  readonly limit?: number;
  /** Timeseries bucket size. Defaults to "day". */
  readonly interval?: Interval;
}

export interface CountedPath {
  readonly path: string;
  readonly views: number;
}

export interface CountedReferrer {
  readonly referrer: string;
  readonly views: number;
}

export interface TimeseriesPoint {
  /** ISO date/hour label, e.g. "2026-07-13" or "2026-07-13T14:00". */
  readonly date: string;
  readonly views: number;
}

/** Aggregated result consumed by the dashboard. */
export interface StatsResult {
  readonly totals: {
    readonly views: number;
    /** Distinct visitors, when the backend can compute it. */
    readonly visitors?: number;
    readonly avgActiveSeconds?: number;
  };
  readonly topPages: readonly CountedPath[];
  readonly topReferrers: readonly CountedReferrer[];
  readonly timeseries: readonly TimeseriesPoint[];
  /** True when the result was extrapolated from a sample rather than a full scan. */
  readonly sampled: boolean;
  /** Fraction of rows actually scanned (e.g. 0.1 = 10%), when sampled. */
  readonly sampleRate?: number;
}

/**
 * The storage contract. Every backend (Analytics Engine, SQL, and future
 * ClickHouse/DuckDB adapters) implements this. `insert` handles ingestion;
 * `stats` handles aggregation for the dashboard.
 */
export interface Adapter {
  insert(event: TrackingEvent): Promise<void>;
  /** Optional bulk path; the server falls back to per-event insert if absent. */
  insertBatch?(events: readonly TrackingEvent[]): Promise<void>;
  stats(query: StatsQuery): Promise<StatsResult>;
}
