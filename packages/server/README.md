# @unifeather/server

Framework-agnostic tracking endpoint for
[unifeather](https://github.com/dennishendricks/unifeather). `createHandler` returns a
plain Web `(request) => Response`, so the same code runs on Cloudflare
Workers/Pages and on Node (`node:http`, Express, …). Ships two storage adapters:
Cloudflare Analytics Engine and Drizzle-backed SQL (Postgres/SQLite/MySQL).

```sh
bun add @unifeather/server   # or: npm i @unifeather/server
```

```ts
import { createHandler } from "@unifeather/server";
import { sqlAdapter } from "@unifeather/server/sql";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }));
const handler = createHandler({ adapter: sqlAdapter({ db }), cors: true });
```

Subpath exports: `@unifeather/server` (handler), `./sql` (Drizzle adapter),
`./analytics-engine` (Cloudflare adapter). `drizzle-orm` is an optional peer —
importing the Analytics Engine adapter never pulls it in.

See the [main README](https://github.com/dennishendricks/unifeather#readme) for the
Cloudflare setup, query-side sampling and the multi-dialect SQL adapter.

MIT © Dennis Hendricks
