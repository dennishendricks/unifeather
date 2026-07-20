import type { RawEvent, TrackingEvent } from "./event.js";
import { parseUA } from "./ua-parser.js";

/** Server-side context merged into a raw event during normalization. */
export interface EnrichContext {
  /** Server-authoritative timestamp (ms). Defaults to the client timestamp. */
  readonly now?: number;
  /** Raw User-Agent header, parsed into browser/OS. */
  readonly userAgent?: string;
  /** Two-letter country code (e.g. from the CF-IPCountry header). */
  readonly country?: string;
  /** Strip the query string from the stored path. Defaults to true. */
  readonly stripQuery?: boolean;
}

const hostOf = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  try {
    return new URL(value).hostname || undefined;
  } catch {
    return undefined;
  }
};

/**
 * Turn a browser {@link RawEvent} into a storage-ready {@link TrackingEvent}.
 * Pure and synchronous — geo/visitor-hash derivation happens in the caller and
 * is passed in via {@link EnrichContext}.
 */
export const normalizeEvent = (raw: RawEvent, context: EnrichContext = {}): TrackingEvent => {
  const url = new URL(raw.url);
  const device = context.userAgent ? parseUA(context.userAgent) : {};
  const stripQuery = context.stripQuery ?? true;
  const referrerHost = hostOf(raw.referrer);

  return {
    eventId: raw.eventId,
    name: raw.name ?? "pageview",
    timestamp: context.now ?? raw.timestamp,
    hostname: url.hostname,
    path: stripQuery ? url.pathname : url.pathname + url.search,
    // Same-site referrers are noise; only keep genuine external referrers.
    referrerHost: referrerHost && referrerHost !== url.hostname ? referrerHost : undefined,
    language: raw.language,
    activeSeconds: raw.activeSeconds ?? 0,
    ...device,
    screenWidth: raw.screenWidth,
    screenHeight: raw.screenHeight,
    country: context.country,
    userId: raw.userId,
    sessionId: raw.sessionId,
    properties: raw.properties,
  };
};
