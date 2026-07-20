# AGENTS.md

Operational guide for AI agents and contributors working **on** unifeather.
User-facing usage lives in [README.md](README.md); this file captures the
non-obvious internals. Keep both in sync when behaviour changes.

## Commands

```sh
bun install
bun run build       # per package: tsup (JS) + tsc --emitDeclarationOnly (.d.ts)
bun run typecheck   # tsc --noEmit per package (TypeScript 7)
bun test            # bun's runner; tests live in packages/*/test/
bun run clean       # remove dist/
```

Run a single suite with `bun test packages/server`.

## Build model — read before touching build config

- **TypeScript 7** (`typescript@^7.0.2`, the native compiler) is the toolchain.
- JS is bundled by **tsup/esbuild**; `.d.ts` are emitted separately by the
  **native `tsc --emitDeclarationOnly`**. tsup's own `dts` is **disabled on
  purpose** — its declaration path uses the legacy JS compiler API, which the
  native TS7 breaks (`useCaseSensitiveFileNames`). Do not re-enable `dts` in a
  `tsup.config.ts`.
- The root `build` script builds **`@unifeather/core` first**, then the rest.
  Order matters: the other packages resolve `@unifeather/core` types from its
  built `dist/` via the workspace symlink. Parallelizing breaks the first run.

## Layout

- `packages/core` — event schema, UA parser, `normalizeEvent`, the `Adapter`
  contract. No runtime deps. Everything else depends on it.
- `packages/tracker` — browser client. `createTracker` (ESM) + a self-executing
  IIFE snippet (`snippet.iife.ts` → `dist/snippet.global.js`).
- `packages/server` — the `Request → Response` handler + adapters (subpath
  exports `./analytics-engine`, `./sql`).
- `packages/dashboard` — Vue SFC shipped as **source** (Astro/Vite compiles it)
  plus a compiled typed `fetchStats` helper.
- `examples/` — reference apps; **outside** the workspace glob, not built/published.

## Conventions

- Modern TS: arrow functions, `const`/`let`, no `enum`/`namespace`.
- ESM everywhere; **import specifiers keep the `.js` extension** (e.g.
  `./ua-parser.js`) — required by `verbatimModuleSyntax` + bundler resolution.
- Every published package sets `"sideEffects": false` and uses `exports` subpaths
  so consumers tree-shake to only what they import. New public entry points need
  both an `exports` entry **and** a tsup `entry`.
- Prefer `import type` for cross-package types so no runtime dependency is pulled
  in (this is why the tracker has zero runtime deps despite importing from core).

## Runtime constraints (do not regress)

- `handler.ts` must stay **Web-standard only** (`Request`, `Response`, `URL`,
  `fetch`, `crypto.subtle`) so it runs unchanged on Cloudflare Workers/Pages and
  Node. `node.ts` is the **only** module allowed to import from `node:*`.
- Keep `drizzle-orm` an **optional peer** and `external` in the server tsup
  config — importing `@unifeather/server/analytics-engine` must never pull in
  drizzle. Same rule for any future adapter's heavy deps.

## Adding a storage adapter

1. Implement the `Adapter` contract from `@unifeather/core`: `insert(event)` and
   `stats(query): StatsResult`. Optional `insertBatch`.
2. Add it under `packages/server/src/adapters/<name>.ts`.
3. Register a subpath: add to `exports` in `package.json` **and** `entry` in
   `tsup.config.ts`; declare its client as an optional peer dependency.
4. Add a test under `packages/server/test/` (use pglite for SQL-like engines).

The contract is deliberately tiny so ClickHouse/DuckDB (columnar, native
`SAMPLE`) can be added without touching the tracker, handler or dashboard.

## Domain rules

- **Identity is three independent, opt-in client options**, default **none**
  (consent-free): `userId` (supplied), `cookieId` (anonymous, long-lived cookie
  `uf_uid`), `session` (session cookie `uf_sid`, sliding expiry).
- **Sampling is query-side**: all raw events are stored; past a row threshold the
  SQL adapter aggregates over an `ORDER BY random()/rand() LIMIT n` sample and
  scales counts up (portable across dialects). Postgres still uses a cheap
  `TABLESAMPLE SYSTEM (1)` page sample only to *estimate* the range size (avoids a
  full `count`); TABLESAMPLE can't back the aggregation itself because a raw-SQL
  `FROM` is incompatible with the query builder's typed column selection. Distinct
  counts are **not** extrapolated → `visitors` is omitted when a query is sampled.

## Gotchas

- `CREATE_TABLE_SQL` is multi-statement; run it via the driver's simple-query
  path (`pool.query`) or drizzle-kit — not every `db.execute()` accepts it.
- The SQL adapter runs through Drizzle's **query builder**, so counts/filters/
  group-by/order-by/limit are portable across every dialect drizzle supports. The
  two hand-written per-dialect bits live in `sql.ts`: `randomOrder` (random()/
  rand()) and `dateBucket` (to_char+date_trunc / strftime / date_format). To add a
  dialect, extend those two and pass `dialect` + your mirror table to `sqlAdapter`.
- `dateBucket`'s SQLite branch assumes `ts` is an **integer unix-seconds** column
  (drizzle `integer({ mode: "timestamp" })`) — hence `strftime(..., 'unixepoch')`.
