import type { Properties, RawEvent } from "@unifeather/core";
import { getOrCreateCookieId, type CookieOptions } from "./cookie.js";
import { getSessionId, type SessionOptions } from "./session.js";

export type { CookieOptions } from "./cookie.js";
export type { SessionOptions } from "./session.js";

export interface TrackerOptions {
  /** URL of the collect endpoint (e.g. "https://analytics.example.com/collect"). */
  readonly endpoint: string;
  /**
   * Custom, app-provided user id. Takes precedence over `cookieId`. Use this
   * when you already have a stable id (e.g. a logged-in user).
   */
  readonly userId?: string;
  /**
   * Anonymous user id persisted in a long-lived first-party cookie. `true` for
   * defaults or pass options. Opt-in — typically requires consent. Ignored if
   * `userId` is set.
   */
  readonly cookieId?: boolean | CookieOptions;
  /** Session id in a short-lived, sliding-expiry cookie. Opt-in. */
  readonly session?: boolean | SessionOptions;
  /** Custom properties merged into every event. */
  readonly properties?: Properties;
  /** Cap on measured active time, in ms. Defaults to 10 minutes. */
  readonly maxActiveMs?: number;
  /** Send a pageview automatically when the page is hidden. Defaults to true. */
  readonly autoTrack?: boolean;
  /** Include screen width/height. Defaults to true. */
  readonly includeScreen?: boolean;
}

export interface Tracker {
  /** Send a custom event. Defaults to a "pageview". */
  track: (name?: string, properties?: Properties) => void;
  /** Convenience alias for a pageview (e.g. on SPA route changes). */
  pageview: (properties?: Properties) => void;
}

const uuid = (): string =>
  crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const post = (endpoint: string, payload: RawEvent): void => {
  const body = JSON.stringify(payload);
  // sendBeacon survives page unload; fall back to keepalive fetch.
  if (navigator.sendBeacon?.(endpoint, new Blob([body], { type: "application/json" }))) return;
  void fetch(endpoint, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
    keepalive: true,
  }).catch(() => {});
};

/**
 * Create a tracker. Minimal by default (no cookies, no ids). Enable
 * `cookieId`, `session`, `userId` and `properties` as needed.
 */
export const createTracker = (options: TrackerOptions): Tracker => {
  const {
    endpoint,
    maxActiveMs = 10 * 60 * 1000,
    autoTrack = true,
    includeScreen = true,
  } = options;

  const userId =
    options.userId ??
    (options.cookieId
      ? getOrCreateCookieId(typeof options.cookieId === "object" ? options.cookieId : {})
      : undefined);
  const sessionId = options.session
    ? getSessionId(typeof options.session === "object" ? options.session : {})
    : undefined;

  // Foreground/active time accounting (ported from the original ping.ts).
  let activeMs = 0;
  let resumedAt: number | null = document.hasFocus() ? performance.now() : null;
  const accumulate = (): void => {
    if (resumedAt !== null) activeMs = Math.min(activeMs + (performance.now() - resumedAt), maxActiveMs);
  };
  const resume = (): void => {
    if (resumedAt === null && activeMs < maxActiveMs) resumedAt = performance.now();
  };
  const pause = (): void => {
    accumulate();
    resumedAt = null;
  };

  const track = (name = "pageview", properties?: Properties): void => {
    accumulate();
    const merged =
      options.properties || properties ? { ...options.properties, ...properties } : undefined;
    post(endpoint, {
      eventId: uuid(),
      name,
      timestamp: Date.now(),
      url: location.href,
      referrer: document.referrer || undefined,
      language: navigator.language,
      activeSeconds: Math.round(activeMs / 1000),
      screenWidth: includeScreen ? screen.width : undefined,
      screenHeight: includeScreen ? screen.height : undefined,
      userId,
      sessionId,
      properties: merged,
    });
  };

  if (autoTrack) {
    let sent = false;
    const flush = (): void => {
      if (sent) return;
      sent = true;
      pause();
      track("pageview");
    };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
      else resume();
    });
    // pagehide covers bfcache/navigation cases visibilitychange can miss.
    addEventListener("pagehide", flush);
  }

  return { track, pageview: (properties?: Properties) => track("pageview", properties) };
};
