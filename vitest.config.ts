import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
        name: "inverted-encounter-visibility tests",
    include: ["tests/**/*.test.ts"],
    environment: "node"
  }
});
