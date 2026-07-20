import { defineConfig } from "tsup";

export default defineConfig([
  {
    // Tree-shakeable ESM for app bundles: `import { createTracker } from ...`
    entry: { index: "src/index.ts", snippet: "src/snippet.ts" },
    format: ["esm"],
    dts: false, // .d.ts emitted by `tsc --emitDeclarationOnly` (TypeScript 7)
    clean: true,
    treeshake: true,
    target: "es2020",
  },
  {
    // Self-executing, minified build for the copy-paste <script> snippet.
    // IIFE format appends ".global.js" → dist/snippet.global.js
    entry: { snippet: "src/snippet.iife.ts" },
    format: ["iife"],
    minify: true,
    treeshake: true,
    clean: false,
    target: "es2020",
  },
]);
