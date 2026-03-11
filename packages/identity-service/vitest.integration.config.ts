import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.integration.spec.ts"],
    // Run integration test files sequentially so they share the same DB without wiping each other's data
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@lframework/shared": path.resolve(__dirname, "../shared/src"),
    },
  },
});
