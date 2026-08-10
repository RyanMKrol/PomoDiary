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
  },
});
