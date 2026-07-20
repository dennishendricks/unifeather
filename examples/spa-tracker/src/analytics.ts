import { createTracker, type Tracker } from "@unifeather/tracker";

// Create one tracker for the app. Only `endpoint` is required — everything
// below is opt-in and typically gated behind a consent decision.
export const analytics: Tracker = createTracker({
  endpoint: "https://analytics.example.com/collect",

  // Pick the identity model you need (or none for consent-free tracking):
  cookieId: true, // anonymous id in a long-lived cookie
  session: { timeoutMinutes: 30 }, // session id in a sliding session cookie
  // userId: currentUser?.id,      // or your own id; wins over cookieId

  properties: { app: "web" }, // sent on every event
});

// SPA route change → send a pageview for the new URL.
export const trackRouteChange = (): void => analytics.pageview();

// Custom event with per-event properties.
export const trackPurchase = (value: number): void =>
  analytics.track("purchase", { value });
