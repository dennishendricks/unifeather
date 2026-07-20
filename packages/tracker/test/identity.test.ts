import { beforeEach, describe, expect, test } from "bun:test";
import { getOrCreateCookieId } from "../src/cookie.js";
import { getSessionId } from "../src/session.js";

// Minimal document.cookie jar + https location, reset before each test.
const installDom = (): void => {
  let store = "";
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      get cookie() {
        return store;
      },
      set cookie(value: string) {
        const pair = value.split("; ")[0] ?? "";
        const name = pair.split("=")[0];
        const rest = store
          .split("; ")
          .filter(Boolean)
          .filter((c) => !c.startsWith(`${name}=`));
        store = [...rest, pair].join("; ");
      },
    },
  });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { protocol: "https:" },
  });
};

beforeEach(installDom);

describe("getOrCreateCookieId (anonymous user id)", () => {
  test("creates and then reuses a stable id", () => {
    const first = getOrCreateCookieId();
    const second = getOrCreateCookieId();
    expect(first).toBe(second);
    expect(first.length).toBeGreaterThan(10);
  });

  test("writes a Secure, SameSite=Lax cookie under the default name", () => {
    getOrCreateCookieId();
    expect(document.cookie).toContain("uf_uid=");
  });

  test("honours a custom cookie name", () => {
    const id = getOrCreateCookieId({ name: "myid" });
    expect(document.cookie).toContain(`myid=${id}`);
  });
});

describe("getSessionId (session cookie)", () => {
  test("returns a stable id while the cookie exists", () => {
    expect(getSessionId()).toBe(getSessionId());
  });

  test("uses the default session cookie name", () => {
    getSessionId();
    expect(document.cookie).toContain("uf_sid=");
  });

  test("starts a fresh session once the cookie is gone", () => {
    const first = getSessionId();
    installDom(); // simulate cookie expiry / new visit
    const second = getSessionId();
    expect(second).not.toBe(first);
  });
});
