/**
 * Value types allowed in custom properties. Kept deliberately narrow so every
 * storage backend (columnar, relational, Analytics Engine) can represent them.
 */
export type PropValue = string | number | boolean;

/** Custom, caller-defined key/value pairs attached to an event. */
export type Properties = Record<string, PropValue>;

/**
 * The raw payload as it leaves the browser. Intentionally minimal — everything
 * that can be derived server-side (UA parsing, geo, visitor hashing) is NOT
 * sent by the client, keeping the payload small and privacy-friendly.
 *
 * Only `eventId`, `timestamp` and `url` are guaranteed; the rest are optional
 * and only present when the corresponding tracker option is enabled.
 */
export interface RawEvent {
  /** Client-generated idempotency id. */
  readonly eventId: string;
  /** Event name, e.g. "pageview" (default) or a custom event. */
  readonly name?: string;
  /** Client clock, milliseconds since epoch. */
  readonly timestamp: number;
  /** Full location href at capture time. */
  readonly url: string;
  readonly referrer?: string;
  readonly language?: string;
  /** Foreground/active time on the page, in seconds. */
  readonly activeSeconds?: number;
  readonly screenWidth?: number;
  readonly screenHeight?: number;
  /** Custom id (passed by the app) or cookie-generated id — opt-in only. */
  readonly userId?: string;
  /** Session id — opt-in only. */
  readonly sessionId?: string;
  readonly properties?: Properties;
}

/**
 * A fully normalized, storage-ready event. Produced by {@link normalizeEvent}
 * after server-side enrichment. This is the single shape every {@link Adapter}
 * persists and the shape stats queries aggregate over.
 */
export interface TrackingEvent {
  readonly eventId: string;
  readonly name: string;
  /** Server-authoritative timestamp, milliseconds since epoch. */
  readonly timestamp: number;
  readonly hostname: string;
  /** URL pathname (query string stripped unless configured otherwise). */
  readonly path: string;
  /** Bare referrer hostname, or undefined for direct/same-site traffic. */
  readonly referrerHost?: string;
  readonly language?: string;
  readonly activeSeconds: number;
  readonly browserName?: string;
  readonly browserVersion?: string;
  readonly osName?: string;
  readonly osVersion?: string;
  readonly screenWidth?: number;
  readonly screenHeight?: number;
  /** Two-letter country code, derived server-side (e.g. from CF-IPCountry). */
  readonly country?: string;
  /** Custom/app-provided or cookie-generated anonymous id — opt-in only. */
  readonly userId?: string;
  /** Session id from a session cookie — opt-in only. */
  readonly sessionId?: string;
  readonly properties?: Properties;
}
