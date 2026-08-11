import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only our own test trees — never .harness/dashboard/*.test.js,
    // which has its own runner inside the harness.
    include: [
      "app/**/*.test.{ts,tsx}",
      "lib/**/*.test.{ts,tsx}",
      "test/**/*.test.{ts,tsx}",
    ],
    // The PGlite-backed DB tests boot a fresh in-process Postgres per test,
    // which can exceed vitest's 5s default when the machine is under load
    // (e.g. the build loop's own gate run). Nothing here is time-critical, so
    // be generous: a timeout should only ever fire on a genuine hang, never on
    // a slow-but-correct run.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
