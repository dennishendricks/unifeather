# @unifeather/tracker

Tiny (~1 KB) privacy-friendly client-side tracker for
[unifeather](https://github.com/dennishendricks/unifeather). Minimal by default —
no cookies, no persistent ids — so it's usable without a consent banner. Cookie
id, session id and custom properties are explicitly opt-in.

```sh
bun add @unifeather/tracker   # or: npm i @unifeather/tracker
```

```ts
import { createTracker } from "@unifeather/tracker";

// Privacy-friendly default: auto pageview with active time, nothing else.
const tracker = createTracker({ endpoint: "/collect" });
tracker.track("signup"); // custom event
```

Prefer no build step? Copy-paste the self-hosted `<script>` snippet
(`@unifeather/tracker/snippet`) instead — see the
[main README](https://github.com/dennishendricks/unifeather#readme).

## Parameters

### `createTracker(options)`

| Parameter | Description | Required |
| --- | --- | --- |
| `endpoint` | URL of the collect endpoint (e.g. `"https://analytics.example.com/collect"`). | **required** |
| `userId` | App-provided stable user id (e.g. a logged-in user). Takes precedence over `cookieId`. | optional |
| `cookieId` | Anonymous id in a long-lived first-party cookie. `true` for defaults, or a `CookieOptions` object. Ignored if `userId` is set. Opt-in, typically needs user consent. | optional |
| `session` | Session id in a short-lived, sliding-expiry cookie. `true` for defaults, or a `SessionOptions` object. Opt-in. | optional |
| `properties` | Custom properties object merged into every event. | optional |
| `maxActiveMs` | Cap on measured active (foreground) time, in milliseconds. Defaults to `600000` (10 min). | optional |
| `autoTrack` | Send a pageview automatically when the page is hidden/unloaded. Defaults to `true`. | optional |
| `includeScreen` | Include screen width/height in events. Defaults to `true`. | optional |

### `CookieOptions` (passed to `cookieId`)

| Parameter | Description | Default |
| --- | --- | --- |
| `name` | Cookie name. | `"uf_uid"` |
| `maxAgeDays` | Cookie lifetime in days. | `365` |
| `sameSite` | `SameSite` policy — `"Lax"` \| `"Strict"` \| `"None"`. | `"Lax"` |

### `SessionOptions` (passed to `session`)

| Parameter | Description | Default |
| --- | --- | --- |
| `name` | Cookie name. | `"uf_sid"` |
| `timeoutMinutes` | Inactivity timeout before the session cookie lapses (sliding). | `30` |
| `sameSite` | `SameSite` policy — `"Lax"` \| `"Strict"` \| `"None"`. | `"Lax"` |

### Snippet `data-*` attributes

The `@unifeather/tracker/snippet` build reads these from the `<script>` tag. Cookie
and session are booleans only — for nested options use `createTracker`.

| Attribute | Description | Default / required |
| --- | --- | --- |
| `data-endpoint` | Collect endpoint URL. | **required** |
| `data-user-id` | App-provided stable user id. | optional |
| `data-cookie-id` | Enable the anonymous cookie id (`""` or `"true"` to enable). | optional |
| `data-session` | Enable the session id (`""` or `"true"` to enable). | optional |
| `data-props` | Custom properties as a JSON object, e.g. `'{"plan":"pro"}'`. Malformed JSON is ignored. | optional |

MIT © Dennis Hendricks
