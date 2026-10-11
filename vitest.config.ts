import { defineConfig } from "vitest/config";

// Every test in spec/ runs against the running app, which spec/global-setup.ts
// finds. Only spec/ runs: a test anywhere else needs adding to `include`.
export default defineConfig({
  test: {
    // Integration files run real SQLite worlds and password hashing. Bound test
    // concurrency instead of starting one full server per available CPU thread.
    maxWorkers: 4,
    include: ["spec/**/*.test.ts"],
    globalSetup: ["./spec/global-setup.ts"],
  },
});
