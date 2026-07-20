import { defineConfig } from "astro/config";
import vue from "@astrojs/vue";

// The Vue integration compiles the .vue island shipped by @unifeather/dashboard.
export default defineConfig({
  integrations: [vue()],
});
