import { readCookie, uuid, writeCookie, type SameSite } from "./cookie.js";

/** Options for the opt-in cookie-based session id. */
export interface SessionOptions {
  /** Cookie name. Defaults to "uf_sid". */
  readonly name?: string;
  /** Inactivity timeout in minutes before the session cookie expires. Defaults to 30. */
  readonly timeoutMinutes?: number;
  /** SameSite policy. Defaults to "Lax". */
  readonly sameSite?: SameSite;
}

/**
 * Return the current session id from a short-lived first-party cookie. The
 * cookie is written with a sliding expiry equal to the inactivity timeout, so
 * it renews on each event and lapses after the visitor is idle. Opt-in.
 */
export const getSessionId = (options: SessionOptions = {}): string => {
  const name = options.name ?? "uf_sid";
  const timeoutSeconds = (options.timeoutMinutes ?? 30) * 60;
  const id = readCookie(name) ?? uuid();
  // Rewrite on every call to slide the expiry window forward.
  writeCookie(name, id, timeoutSeconds, options.sameSite);
  return id;
};
