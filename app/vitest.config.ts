import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    // Match the tsconfig "@/*" → "src/*" path alias so runtime imports resolve.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Finance engine + AI guardrails are pure logic — run in Node.
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
  },
});
