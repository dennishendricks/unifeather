import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: false, // .d.ts emitted by `tsc --emitDeclarationOnly` (TypeScript 7)
  clean: true,
  treeshake: true,
  target: "es2022",
});
