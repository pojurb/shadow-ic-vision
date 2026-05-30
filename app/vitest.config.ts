import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Finance engine + AI guardrails are pure logic — run in Node.
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
  },
});
