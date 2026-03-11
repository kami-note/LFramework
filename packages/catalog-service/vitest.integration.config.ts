import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.integration.spec.ts"],
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@lframework/shared": path.resolve(__dirname, "../shared/src"),
    },
  },
});
