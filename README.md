# unifeather

Lightweight, privacy-friendly, tree-shakeable website analytics. Three pieces you
can host anywhere — Cloudflare Pages/Workers or your own Node server.

| Package | What it is |
| --- | --- |
| [`@unifeather/tracker`](packages/tracker) | ~1 KB client script. Minimal by default; cookie id, session id and custom properties are opt-in. NPM import **or** copy-paste `<script>`. |
| [`@unifeather/core`](packages/core) | Shared event schema, UA parser, normalization and the storage `Adapter` contract. |
| [`@unifeather/server`](packages/server) | Framework-agnostic endpoint (`Request → Response`) + adapters for Cloudflare Analytics Engine and Drizzle-backed SQL. |
| [`@unifeather/dashboard`](packages/dashboard) | Minimal Vue dashboard, embeddable as an Astro island. |

## Design goals

- **Privacy-first default.** Out of the box no cookies, no persistent ids, minimal
  data — usable without a consent banner. Everything richer (cookie id, session,
  custom props) is explicitly opt-in.
- **Runs everywhere.** The endpoint is a plain Web `fetch` handler, so the same
  code runs on Cloudflare and on Node (`node:http`, Express, …).
- **Tree-shakeable & publishable.** ESM, `sideEffects: false`, subpath exports,
  `.d.ts` types. You ship only the code you import.

---

## 1. Tracker

### Option A — copy-paste snippet (no build)

```html
<script
  src="https://cdn.example.com/unifeather/snippet.global.js"
  data-endpoint="https://analytics.example.com/collect"
  defer
></script>
```

Opt-in attributes: `data-cookie-id`, `data-session`, `data-user-id="…"`,
`data-props='{"plan":"pro"}'`. The created tracker is exposed as `window.unifeather`
so you can send custom events: `window.unifeather?.track("signup")`.

### Option B — NPM import (tree-shakeable)

```ts
import { createTracker } from "@unifeather/tracker";

// Privacy-friendly default: auto pageview with active time, nothing else.
const tracker = createTracker({ endpoint: "/collect" });

// Everything below is optional:
const rich = createTracker({
  endpoint: "/collect",
  cookieId: true,                 // or { maxAgeDays: 90 }
  session: { timeoutMinutes: 30 },
  userId: currentUser?.id,        // takes precedence over cookieId
  properties: { plan: "pro" },    // sent on every event
});

rich.track("checkout", { value: 42 }); // custom event
rich.pageview();                        // e.g. on SPA route change
```

### Identifying visitors — three independent, opt-in options

By default **no visitor identity is sent at all** (no cookies, no ids) — this is
the consent-free mode. When you do have consent, enable exactly what you need:

| Option | What it does | Storage |
| --- | --- | --- |
| `userId: "…"` | Use an id you already have (e.g. a logged-in user). Takes precedence over `cookieId`. | none (you supply it) |
| `cookieId: true` | Generate an **anonymous** id and persist it in a long-lived first-party cookie. | `uf_uid` cookie (365 d) |
| `session: true` | Attach a **session** id in a short-lived, sliding-expiry cookie (30 min idle). | `uf_sid` cookie |

The dashboard's distinct-visitor count is `COUNT(DISTINCT user_id)`, so it is only
populated when `userId` or `cookieId` is in use; in consent-free mode you still get
pageviews, top pages, referrers and the timeseries.

---

## 2. Endpoint

`createHandler` returns a `(request) => Response`. Pick an adapter.

### Cloudflare Worker + Analytics Engine

```ts
import { createHandler } from "@unifeather/server";
import { analyticsEngineAdapter } from "@unifeather/server/analytics-engine";

export default {
  fetch(request: Request, env: Env) {
    const handler = createHandler({
      adapter: analyticsEngineAdapter({
        dataset: env.AE,                    // wrangler binding (ingest)
        accountId: env.CF_ACCOUNT_ID,       // SQL API (stats)
        apiToken: env.CF_API_TOKEN,
        datasetName: "unifeather",
      }),
      cors: true,
    });
    return handler(request);
  },
};
```

```toml
# wrangler.toml
[[analytics_engine_datasets]]
binding = "AE"
dataset = "unifeather"
```

### Node server + Postgres (Drizzle)

```ts
import { createServer } from "node:http";
import { createHandler, createNodeListener } from "@unifeather/server";
import { sqlAdapter, CREATE_TABLE_SQL } from "@unifeather/server/sql";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);
// One-time schema setup. CREATE_TABLE_SQL is multi-statement, so run it through
// the driver's simple-query path (or manage it with drizzle-kit migrations).
await pool.query(CREATE_TABLE_SQL);

const handler = createHandler({
  adapter: sqlAdapter({
    db,
    sampling: { threshold: 1_000_000, rate: 0.1 }, // query-side sampling
  }),
  cors: ["https://mysite.example.com"],
});

createServer(createNodeListener(handler)).listen(3000);
```

The SQL adapter runs through Drizzle's query builder, so it works on every
dialect drizzle supports. It defaults to Postgres; for SQLite/D1 or MySQL pass
your mirror `table` and the matching `dialect: "sqlite" | "mysql"`:

```ts
sqlAdapter({ db, table: myEvents, dialect: "sqlite" });
```

**Sampling.** Every raw event is always stored. On tables past `threshold`, the
stats queries aggregate over an `ORDER BY random() LIMIT n` sample and scale the
counts back up — the same idea Analytics Engine applies automatically, done here
at query time and portable across dialects. (Postgres additionally uses a cheap
`TABLESAMPLE SYSTEM (1)` estimate to decide *whether* to sample without a full
`count`.) Distinct-visitor counts are omitted when a query is sampled (distinct
counts don't extrapolate reliably).

---

## 3. Dashboard (Astro island)

```astro
---
import UnifeatherDashboard from "@unifeather/dashboard/UnifeatherDashboard.vue";
---
<UnifeatherDashboard client:load apiUrl="/api/stats" days={30} />
```

Requires `@astrojs/vue` and the peers `vue`, `chart.js`, `vue-chartjs`. Prefer to
build your own UI? Use the typed fetch helper:

```ts
import { fetchStats } from "@unifeather/dashboard";
const stats = await fetchStats("/api/stats", { from, to, interval: "day" });
```

---

## Examples

Runnable reference apps in [`examples/`](examples): a Cloudflare Worker (Analytics
Engine), a Node + Postgres server, the copy-paste browser snippet, the
`createTracker` NPM import for an SPA, and the Astro-island dashboard.

## Development

Bun workspaces, **TypeScript 7**. Each package is bundled to ESM by tsup
(esbuild) and its `.d.ts` are emitted by the native `tsc --emitDeclarationOnly`.

```sh
bun install
bun run build       # tsup (JS) + tsc --emitDeclarationOnly (types) → dist
bun run typecheck   # tsc --noEmit per package (TypeScript 7)
bun test            # run the test suite
```

Contributing to the library itself? See [AGENTS.md](AGENTS.md) for the build
model, runtime constraints and how to add a storage adapter.

## Testing

Tests use the built-in [`bun test`](https://bun.sh/docs/cli/test) runner (zero
extra tooling) and live in each package's `test/` folder:

| Suite | Covers |
| --- | --- |
| `core/test/normalize.test.ts` | Event normalization (path/query, referrer, server time, device enrichment) and the UA parser across Chrome/Firefox/Safari. |
| `tracker/test/identity.test.ts` | The three identity options — anonymous cookie id and the session cookie (creation, reuse, custom names, new session after expiry). |
| `server/test/handler.test.ts` | Endpoint behaviour: ingest + normalization, batch, malformed body (400), CORS preflight, stats JSON, 404. |
| `server/test/sql-adapter.test.ts` | The Drizzle SQL adapter against **real Postgres** (pglite/WASM) **and SQLite** (bun:sqlite): aggregation, distinct visitors, timeseries, and the query-side `random()`+`LIMIT` sampling path. |

```sh
bun test                                    # everything
bun test packages/server                    # one package
```
