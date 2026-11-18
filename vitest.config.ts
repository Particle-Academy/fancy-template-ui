import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Core tests run in node (it must stay DOM-free); a .tsx test opts into
    // jsdom with a `// @vitest-environment jsdom` docblock.
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    restoreMocks: true,
  },
  esbuild: {
    jsx: "automatic",
  },
});
