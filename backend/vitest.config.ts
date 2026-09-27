import { defineConfig } from "vitest/config";

// Integration tests share one Postgres database, so test files run one after another.
export default defineConfig({ test: { fileParallelism: false } });
