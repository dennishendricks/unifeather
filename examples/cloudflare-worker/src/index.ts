import { createHandler } from "@unifeather/server";
import { analyticsEngineAdapter } from "@unifeather/server/analytics-engine";

interface Env {
  /** Analytics Engine binding — see wrangler.toml. */
  AE: AnalyticsEngineDataset;
  /** Cloudflare account id (wrangler var). */
  CF_ACCOUNT_ID: string;
  /** API token with "Account Analytics: Read" (wrangler secret). */
  CF_API_TOKEN: string;
}

export default {
  fetch(request, env) {
    const handler = createHandler({
      adapter: analyticsEngineAdapter({
        dataset: env.AE, // ingest via the Workers binding
        accountId: env.CF_ACCOUNT_ID, // stats via the SQL API
        apiToken: env.CF_API_TOKEN,
        datasetName: "unifeather",
      }),
      // Reflect the request origin. In production, pass an explicit allowlist:
      //   cors: ["https://mysite.example.com"]
      cors: true,
    });
    return handler(request);
  },
} satisfies ExportedHandler<Env>;
