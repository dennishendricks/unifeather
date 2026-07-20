# @unifeather/dashboard

Minimal Vue dashboard for [unifeather](https://github.com/dennishendricks/unifeather)
stats — embeddable as an Astro island. Ships the SFC as source plus a typed
`fetchStats` helper.

```sh
bun add @unifeather/dashboard   # or: npm i @unifeather/dashboard
```

Peers: `vue`, `chart.js`, `vue-chartjs` (and `@astrojs/vue` for the island).

```astro
---
import UnifeatherDashboard from "@unifeather/dashboard/UnifeatherDashboard.vue";
---
<UnifeatherDashboard client:load apiUrl="/api/stats" days={30} />
```

Building your own UI instead? Use the typed fetch helper:

```ts
import { fetchStats } from "@unifeather/dashboard";
const stats = await fetchStats("/api/stats", { from, to, interval: "day" });
```

See the [main README](https://github.com/dennishendricks/unifeather#readme) for details.

MIT © Dennis Hendricks
