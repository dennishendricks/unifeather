import { defineConfig } from "tsup";

export default defineConfig({
  // Only the typed fetch helper is compiled; the .vue SFC ships as source so
  // the consumer's Astro/Vite toolchain compiles it for its island runtime.
  entry: { index: "src/index.ts" },
  format: ["esm"],
  dts: false, // .d.ts emitted by `tsc --emitDeclarationOnly` (TypeScript 7)
  clean: true,
  treeshake: true,
  target: "es2022",
});
