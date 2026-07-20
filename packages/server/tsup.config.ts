import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "adapters/analytics-engine": "src/adapters/analytics-engine.ts",
    "adapters/sql": "src/adapters/sql.ts",
  },
  format: ["esm"],
  dts: false, // .d.ts emitted by `tsc --emitDeclarationOnly` (TypeScript 7)
  clean: true,
  treeshake: true,
  target: "es2022",
  // Keep drizzle external so it stays an optional peer dependency.
  external: ["drizzle-orm"],
});
