<script setup lang="ts">
import { ref, onMounted } from "vue";
import { Line } from "vue-chartjs";
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Filler,
} from "chart.js";
import { fetchStats } from "./stats.js";
import type { StatsResult } from "@unifeather/core";

ChartJS.register(Title, Tooltip, Legend, LineElement, CategoryScale, LinearScale, PointElement, Filler);

// apiUrl points at the /api/stats route served by @unifeather/server.
const props = withDefaults(
  defineProps<{ apiUrl?: string; days?: number }>(),
  { apiUrl: "/api/stats", days: 7 },
);

const stats = ref<StatsResult | null>(null);
const chartData = ref({ labels: [] as string[], datasets: [] as unknown[] });
const isLoading = ref(true);
const error = ref<string | null>(null);

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { y: { beginAtZero: true } },
};

const nf = new Intl.NumberFormat();

onMounted(async () => {
  try {
    const to = Date.now();
    const from = to - props.days * 86_400_000;
    const data = await fetchStats(props.apiUrl, { from, to });
    stats.value = data;
    chartData.value = {
      labels: data.timeseries.map((p) => p.date),
      datasets: [
        {
          label: "Pageviews",
          data: data.timeseries.map((p) => p.views),
          borderColor: "#f6821f",
          backgroundColor: "rgba(246, 130, 31, 0.15)",
          tension: 0.3,
          fill: true,
        },
      ],
    };
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div class="uf-dashboard">
    <p v-if="isLoading">Lade Daten…</p>
    <p v-else-if="error" class="uf-error">{{ error }}</p>

    <template v-else-if="stats">
      <div class="uf-cards">
        <div class="uf-card">
          <span class="uf-card-label">Pageviews</span>
          <span class="uf-card-value">{{ nf.format(stats.totals.views) }}</span>
        </div>
        <div v-if="stats.totals.visitors != null" class="uf-card">
          <span class="uf-card-label">Besucher</span>
          <span class="uf-card-value">{{ nf.format(stats.totals.visitors) }}</span>
        </div>
        <div v-if="stats.totals.avgActiveSeconds != null" class="uf-card">
          <span class="uf-card-label">Ø Verweildauer</span>
          <span class="uf-card-value">{{ stats.totals.avgActiveSeconds }}s</span>
        </div>
      </div>

      <p v-if="stats.sampled" class="uf-sampled">
        Hochgerechnet aus einer {{ Math.round((stats.sampleRate ?? 0) * 100) }}%-Stichprobe.
      </p>

      <section class="uf-section">
        <h2>Pageviews im Verlauf</h2>
        <div class="uf-chart">
          <Line :data="chartData" :options="chartOptions" />
        </div>
      </section>

      <section class="uf-section">
        <h2>Top Seiten</h2>
        <table>
          <thead>
            <tr><th>Seite</th><th>Pageviews</th></tr>
          </thead>
          <tbody>
            <tr v-for="page in stats.topPages" :key="page.path">
              <td>{{ page.path }}</td>
              <td>{{ nf.format(page.views) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="stats.topReferrers.length" class="uf-section">
        <h2>Top Verweise</h2>
        <table>
          <thead>
            <tr><th>Quelle</th><th>Pageviews</th></tr>
          </thead>
          <tbody>
            <tr v-for="ref in stats.topReferrers" :key="ref.referrer">
              <td>{{ ref.referrer }}</td>
              <td>{{ nf.format(ref.views) }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
  </div>
</template>

<style scoped>
.uf-dashboard {
  font-family: system-ui, sans-serif;
  max-width: 800px;
}
.uf-cards {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}
.uf-card {
  display: flex;
  flex-direction: column;
  padding: 0.75rem 1rem;
  border: 1px solid #e2e2e2;
  border-radius: 0.5rem;
  min-width: 8rem;
}
.uf-card-label {
  font-size: 0.75rem;
  color: #666;
}
.uf-card-value {
  font-size: 1.5rem;
  font-weight: 600;
}
.uf-sampled {
  font-size: 0.8rem;
  color: #888;
  margin: 0.5rem 0 0;
}
.uf-section h2 {
  font-size: 1rem;
  font-weight: 600;
  margin: 1.5rem 0 0.5rem;
}
.uf-chart {
  height: 260px;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  text-align: left;
  padding: 0.4rem 0.6rem;
  border-bottom: 1px solid #e2e2e2;
}
.uf-error {
  color: #c0392b;
}
</style>
