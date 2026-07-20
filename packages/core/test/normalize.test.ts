import { describe, expect, test } from "bun:test";
import { normalizeEvent } from "../src/normalize.js";
import { parseUA } from "../src/ua-parser.js";

const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const FIREFOX_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0";
const SAFARI_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1";

describe("normalizeEvent", () => {
  const raw = { eventId: "e1", timestamp: 1000, url: "https://site.example/pricing?ref=x" };

  test("derives hostname/path, strips query, defaults name and activeSeconds", () => {
    const e = normalizeEvent(raw);
    expect(e.hostname).toBe("site.example");
    expect(e.path).toBe("/pricing");
    expect(e.name).toBe("pageview");
    expect(e.activeSeconds).toBe(0);
  });

  test("keeps query string when stripQuery is false", () => {
    expect(normalizeEvent(raw, { stripQuery: false }).path).toBe("/pricing?ref=x");
  });

  test("server `now` overrides the client timestamp", () => {
    expect(normalizeEvent(raw, { now: 5000 }).timestamp).toBe(5000);
    expect(normalizeEvent(raw).timestamp).toBe(1000);
  });

  test("drops same-site referrer, keeps external referrer host", () => {
    expect(normalizeEvent({ ...raw, referrer: "https://site.example/from" }).referrerHost).toBeUndefined();
    expect(normalizeEvent({ ...raw, referrer: "https://www.google.com/search" }).referrerHost).toBe("www.google.com");
  });

  test("enriches device info from the user agent and passes through country", () => {
    const e = normalizeEvent(raw, { userAgent: CHROME_MAC, country: "DE" });
    expect(e.browserName).toBe("Chrome");
    expect(e.osName).toBe("macOS");
    expect(e.country).toBe("DE");
  });

  test("carries opt-in identity fields through unchanged", () => {
    const e = normalizeEvent({ ...raw, userId: "u1", sessionId: "s1", properties: { plan: "pro" } });
    expect(e.userId).toBe("u1");
    expect(e.sessionId).toBe("s1");
    expect(e.properties).toEqual({ plan: "pro" });
  });
});

describe("parseUA", () => {
  test("Chrome on macOS", () => {
    expect(parseUA(CHROME_MAC)).toEqual({
      browserName: "Chrome",
      browserVersion: "120",
      osName: "macOS",
      osVersion: "10.15.7",
    });
  });

  test("Firefox on Windows 10/11", () => {
    const d = parseUA(FIREFOX_WIN);
    expect(d.browserName).toBe("Firefox");
    expect(d.osName).toBe("Windows");
    expect(d.osVersion).toBe("10/11");
  });

  test("Safari on iOS", () => {
    const d = parseUA(SAFARI_IOS);
    expect(d.browserName).toBe("Safari");
    expect(d.osName).toBe("iOS");
    expect(d.osVersion).toBe("17.2");
  });
});
