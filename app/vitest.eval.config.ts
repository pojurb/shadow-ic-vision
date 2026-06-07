import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Config for the OPTIONAL live eval (`npm run eval`). Picks up *.eval.ts only, so the
// default `npm test` never makes API calls. Gated by a key inside the eval itself.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.eval.ts"],
    testTimeout: 120_000,
  },
});
