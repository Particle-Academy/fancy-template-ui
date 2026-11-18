import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts", core: "src/core/index.ts" },
  format: ["esm", "cjs"],
  dts: true,
  // Every one of these is a peer. Bundling react-fancy or fancy-template would
  // ship a second copy into the consumer's tree, which looks like success until
  // two copies of a context (or of a profile) disagree.
  external: [
    "react",
    "react-dom",
    "@particle-academy/react-fancy",
    "@particle-academy/fancy-doc-commons",
    "@particle-academy/fancy-template",
    "@particle-academy/last-word-ui",
  ],
  treeshake: true,
  clean: true,
  sourcemap: true,
});
