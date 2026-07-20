export type SameSite = "Lax" | "Strict" | "None";

/** Options for the opt-in cookie-based anonymous user id. */
export interface CookieOptions {
  /** Cookie name. Defaults to "uf_uid". */
  readonly name?: string;
  /** Lifetime in days. Defaults to 365. */
  readonly maxAgeDays?: number;
  /** SameSite policy. Defaults to "Lax". */
  readonly sameSite?: SameSite;
}

/** Generate a random id (RFC 4122 UUID when available). Shared internal helper. */
export const uuid = (): string =>
  crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Read a cookie value by name, or undefined. Shared internal helper. */
export const readCookie = (name: string): string | undefined => {
  const prefix = `${name}=`;
  for (const part of document.cookie.split("; ")) {
    if (part.startsWith(prefix)) return decodeURIComponent(part.slice(prefix.length));
  }
  return undefined;
};

/** Write a cookie. Shared internal helper. `Secure` is added on HTTPS. */
export const writeCookie = (
  name: string,
  value: string,
  maxAgeSeconds: number,
  sameSite: SameSite = "Lax",
): void => {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=${sameSite}${secure}`;
};

/**
 * Read the anonymous user id from a long-lived first-party cookie, creating and
 * persisting a new random id on first visit. Opt-in — typically requires consent.
 */
export const getOrCreateCookieId = (options: CookieOptions = {}): string => {
  const name = options.name ?? "uf_uid";
  const existing = readCookie(name);
  if (existing) return existing;

  const id = uuid();
  writeCookie(name, id, (options.maxAgeDays ?? 365) * 86400, options.sameSite);
  return id;
};
