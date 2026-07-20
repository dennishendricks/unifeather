import { createTracker, type Tracker, type TrackerOptions } from "./index.js";

const bool = (value: string | undefined): boolean => value === "" || value === "true";

/**
 * Initialize a tracker from a `<script>` tag's `data-*` attributes. Reads the
 * currently executing script (or the last matching one). Returns the tracker,
 * or undefined if no endpoint is configured.
 *
 * Supported attributes:
 *   data-endpoint (required)  data-user-id  data-cookie-id
 *   data-session              data-props (JSON object)
 */
export const initFromScript = (script?: HTMLScriptElement): Tracker | undefined => {
  const el =
    script ??
    (document.currentScript as HTMLScriptElement | null) ??
    document.querySelector<HTMLScriptElement>("script[data-endpoint]");
  if (!el) return undefined;

  const endpoint = el.dataset.endpoint;
  if (!endpoint) return undefined;

  let properties: TrackerOptions["properties"];
  if (el.dataset.props) {
    try {
      properties = JSON.parse(el.dataset.props);
    } catch {
      // Malformed JSON — ignore rather than break tracking.
    }
  }

  return createTracker({
    endpoint,
    userId: el.dataset.userId,
    cookieId: bool(el.dataset.cookieId),
    session: bool(el.dataset.session),
    properties,
  });
};
