# Node + Postgres endpoint

A plain `node:http` server hosting the unifeather endpoint, backed by Postgres
through the Drizzle SQL adapter.

## Setup

```sh
bun install            # or npm install
```

Copy the example env file and adjust it (any Postgres-compatible URL — local,
Neon, Supabase, Timescale, …):

```sh
cp .env.example .env
```

## Run

```sh
npm start              # node --experimental-strip-types src/server.ts
# load .env too:  node --env-file=.env --experimental-strip-types src/server.ts
```

Then point the tracker's `endpoint` at `http://localhost:3000/collect` and the
dashboard's `apiUrl` at `http://localhost:3000/api/stats`.

Swap the driver import in `src/server.ts` (`drizzle-orm/node-postgres` →
`drizzle-orm/neon-http`, `drizzle-orm/pglite`, …) to change databases without
touching the adapter code.
