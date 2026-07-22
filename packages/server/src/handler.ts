import { normalizeEvent, type Adapter, type Interval, type RawEvent, type StatsQuery } from "@unifeather/core";

export interface HandlerOptions {
  readonly adapter: Adapter;
  /** Ingest path. Defaults to "/collect". */
  readonly collectPath?: string;
  /** Stats path. Defaults to "/api/stats". */
  readonly statsPath?: string;
  /**
   * CORS `Access-Control-Allow-Origin`. `true` reflects the request origin,
   * a string/array whitelists origins, `false`/omitted disables CORS.
   */
  readonly cors?: boolean | string | readonly string[];
  /** Keep the query string in stored paths. Defaults to false (stripped). */
  readonly keepQuery?: boolean;
}

export type FetchHandler = (request: Request) => Promise<Response>;

const resolveOrigin = (cors: HandlerOptions["cors"], requestOrigin: string | null): string | undefined => {
  if (!cors) return undefined;
  if (cors === true) return requestOrigin ?? "*";
  const list = typeof cors === "string" ? [cors] : cors;
  return requestOrigin && list.includes(requestOrigin) ? requestOrigin : undefined;
};

const corsHeaders = (origin: string | undefined): Record<string, string> =>
  origin
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        Vary: "Origin",
      }
    : {};

/**
 * Build a framework-agnostic fetch handler for the tracking endpoint. Works
 * unchanged on Cloudflare Workers/Pages (`export default { fetch }`) and on
 * Node via {@link createNodeListener}.
 */
export const createHandler = (options: HandlerOptions): FetchHandler => {
  const { adapter, collectPath = "/collect", statsPath = "/api/stats" } = options;

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const origin = resolveOrigin(options.cors, request.headers.get("Origin"));
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    if (request.method === "POST" && url.pathname === collectPath) {
      return handleCollect(request, options, cors);
    }

    if (request.method === "GET" && url.pathname === statsPath) {
      return handleStats(url, adapter, cors);
    }

    return new Response("Not Found", { status: 404, headers: cors });
  };
};

const handleCollect = async (request: Request, options: HandlerOptions, cors: Record<string, string>): Promise<Response> => {
  let body: RawEvent | readonly RawEvent[];
  try {
    body = (await request.json()) as RawEvent | readonly RawEvent[];
  } catch {
    return new Response("Bad Request", { status: 400, headers: cors });
  }

  const raws = Array.isArray(body) ? body : [body];
  const now = Date.now();
  const userAgent = request.headers.get("User-Agent") ?? undefined;
  const country = request.headers.get("CF-IPCountry") ?? undefined;

  const context = { now, userAgent, country, stripQuery: !options.keepQuery };
  const events = raws.map((raw) => normalizeEvent(raw, context));

  try {
    if (options.adapter.insertBatch && events.length > 1) {
      await options.adapter.insertBatch(events);
    } else {
      await Promise.all(events.map((event) => options.adapter.insert(event)));
    }
  } catch {
    return new Response("Storage Error", { status: 502, headers: cors });
  }

  return new Response(null, { status: 204, headers: cors });
};

const parseInterval = (value: string | null): Interval => (value === "hour" ? "hour" : "day");

const handleStats = async (url: URL, adapter: Adapter, cors: Record<string, string>): Promise<Response> => {
  const params = url.searchParams;
  const now = Date.now();
  const query: StatsQuery = {
    from: Number(params.get("from")) || now - 7 * 86400_000,
    to: Number(params.get("to")) || now,
    limit: Number(params.get("limit")) || 10,
    interval: parseInterval(params.get("interval")),
  };

  try {
    const result = await adapter.stats(query);
    return Response.json(result, { headers: cors });
  } catch {
    return new Response("Query Error", { status: 502, headers: cors });
  }
};
