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

MIT © Dennis Hendricks
