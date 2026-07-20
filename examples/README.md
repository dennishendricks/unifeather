# unifeather examples

Runnable reference implementations for each integration point. They live outside
the workspace glob, so they are not built or published with the library — copy
one into your own project as a starting point.

| Example | Shows |
| --- | --- |
| [`cloudflare-worker/`](cloudflare-worker) | Endpoint on a Cloudflare Worker backed by **Analytics Engine** (ingest binding + SQL API for stats). |
| [`node-postgres/`](node-postgres) | Endpoint on a plain **Node** server backed by **Postgres** via the Drizzle SQL adapter, with query-side sampling. |
| [`browser-snippet/`](browser-snippet) | The copy-paste `<script>` tracker with `data-*` configuration and a custom event. |
| [`spa-tracker/`](spa-tracker) | The tree-shakeable `createTracker` NPM import for an app bundle (SPA route changes, custom events). |
| [`astro-dashboard/`](astro-dashboard) | The Vue dashboard embedded as an Astro island. |

Each example pins `@unifeather/*` by version. Inside this repo you can instead
point them at the workspace with `bun add @unifeather/server@workspace:*` etc.
