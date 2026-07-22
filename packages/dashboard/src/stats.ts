import type { Interval, StatsResult } from "@unifeather/core";

export interface FetchStatsParams {
  /** Inclusive lower bound (ms epoch). Defaults server-side to 7 days ago. */
  readonly from?: number;
  /** Exclusive upper bound (ms epoch). Defaults server-side to now. */
  readonly to?: number;
  readonly limit?: number;
  readonly interval?: Interval;
}

/** Typed fetch for the `/api/stats` endpoint. Returns the {@link StatsResult}. */
export const fetchStats = async (apiUrl: string, params: FetchStatsParams = {}, init?: RequestInit): Promise<StatsResult> => {
  const url = new URL(apiUrl, typeof location !== "undefined" ? location.href : undefined);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`stats request failed: ${res.status}`);
  return (await res.json()) as StatsResult;
};
