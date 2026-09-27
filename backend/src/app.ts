import express from "express";
import type { HealthResponse } from "@free-site/shared";

interface AppDependencies {
  checkDatabase: () => Promise<boolean>;
}

/**
 * Builds the Express app with its dependencies injected.
 * @param {AppDependencies} dependencies
 */
export function createApp({ checkDatabase }: AppDependencies) {
  const app = express();

  app.get("/api/health", async (_request, response) => {
    const database = await checkDatabase();
    const body: HealthResponse = { status: database ? "ok" : "degraded", database };
    response.status(database ? 200 : 503).json(body);
  });

  return app;
}
