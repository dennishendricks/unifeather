import { describe, expect, test } from "bun:test";
import type { Adapter, TrackingEvent } from "@unifeather/core";
import { createHandler } from "../src/handler.js";

const memoryAdapter = () => {
  const events: TrackingEvent[] = [];
  const adapter: Adapter = {
    async insert(e) {
      events.push(e);
    },
    async stats(q) {
      const inRange = events.filter((e) => e.timestamp >= q.from && e.timestamp < q.to);
      return {
        totals: { views: inRange.length },
        topPages: [],
        topReferrers: [],
        timeseries: [],
        sampled: false,
      };
    },
  };
  return { events, adapter };
};

const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const collect = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://a.co/collect", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

describe("createHandler", () => {
  test("ingests a pageview (204) and normalizes it server-side", async () => {
    const { events, adapter } = memoryAdapter();
    const handler = createHandler({ adapter, cors: true });
    const res = await handler(
      collect("/collect", { eventId: "e1", timestamp: Date.now(), url: "https://site.example/pricing?x=1", referrer: "https://google.com/" }, {
        Origin: "https://site.example",
        "User-Agent": CHROME_MAC,
        "CF-IPCountry": "DE",
      }),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://site.example");
    expect(events).toHaveLength(1);
    expect(events[0]!.path).toBe("/pricing");
    expect(events[0]!.browserName).toBe("Chrome");
    expect(events[0]!.osName).toBe("macOS");
    expect(events[0]!.country).toBe("DE");
    expect(events[0]!.referrerHost).toBe("google.com");
  });

  test("accepts a batch array in one request", async () => {
    const { events, adapter } = memoryAdapter();
    const handler = createHandler({ adapter });
    const now = Date.now();
    const res = await handler(
      collect("/collect", [
        { eventId: "a", timestamp: now, url: "https://s.example/a" },
        { eventId: "b", timestamp: now, url: "https://s.example/b" },
      ]),
    );
    expect(res.status).toBe(204);
    expect(events).toHaveLength(2);
  });

  test("rejects malformed JSON with 400", async () => {
    const { adapter } = memoryAdapter();
    const handler = createHandler({ adapter });
    const res = await handler(
      new Request("https://a.co/collect", { method: "POST", body: "{not json" }),
    );
    expect(res.status).toBe(400);
  });

  test("answers CORS preflight with 204 and allowed methods", async () => {
    const { adapter } = memoryAdapter();
    const handler = createHandler({ adapter, cors: ["https://site.example"] });
    const res = await handler(
      new Request("https://a.co/collect", { method: "OPTIONS", headers: { Origin: "https://site.example" } }),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });

  test("serves stats as JSON", async () => {
    const { adapter } = memoryAdapter();
    const handler = createHandler({ adapter });
    const now = Date.now();
    await handler(collect("/collect", { eventId: "e1", timestamp: now, url: "https://s.example/x" }));
    const res = await handler(new Request(`https://a.co/api/stats?from=${now - 1000}&to=${now + 1000}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totals.views).toBe(1);
  });

  test("returns 404 for unknown routes", async () => {
    const { adapter } = memoryAdapter();
    const handler = createHandler({ adapter });
    expect((await handler(new Request("https://a.co/nope"))).status).toBe(404);
  });
});
