import { createServer } from "node:http";
import { createHandler, createNodeListener } from "@unifeather/server";
import { CREATE_TABLE_SQL, sqlAdapter } from "@unifeather/server/sql";
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
    // Past ~1M rows in the queried range, aggregate over a 10% TABLESAMPLE and
    // scale the counts back up. Every raw event is still stored.
    sampling: { threshold: 1_000_000, rate: 0.1 },
  }),
  cors: ["https://mysite.example.com"],
});

const port = Number(process.env.PORT) || 3000;
createServer(createNodeListener(handler)).listen(port, () => {
  console.log(`unifeather collector listening on http://localhost:${port}`);
  console.log(`  POST /collect     — ingest events`);
  console.log(`  GET  /api/stats   — aggregated stats for the dashboard`);
});
