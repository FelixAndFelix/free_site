import express, { type NextFunction, type Request, type Response, type Router } from "express";
import cookieParser from "cookie-parser";
import type { ApiError, HealthResponse } from "@free-site/shared";

interface AppDependencies {
  checkDatabase: () => Promise<boolean>;
  authRouter: Router;
  trustProxy?: string;
}

/**
 * Builds the Express app with its dependencies injected.
 * @param {AppDependencies} dependencies
 */
export function createApp({ checkDatabase, authRouter, trustProxy }: AppDependencies) {
  const app = express();
  if (trustProxy) app.set("trust proxy", trustProxy);
  app.use(express.json({ limit: "10kb" }));
  app.use(cookieParser());

  app.get("/api/health", async (_request, response) => {
    const database = await checkDatabase();
    const body: HealthResponse = { status: database ? "ok" : "degraded", database };
    response.status(database ? 200 : 503).json(body);
  });

  app.use("/api/auth", authRouter);
  app.use(handleError);

  return app;
}

/**
 * Turns thrown errors into JSON: malformed bodies become 400, everything else 500.
 * Express recognises error handlers by their four parameters, so `next` must stay.
 * @param {unknown} error
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function handleError(error: unknown, _request: Request, response: Response, _next: NextFunction) {
  const status = (error as { status?: number }).status;
  if (status && status >= 400 && status < 500) {
    const body: ApiError = { error: "invalid_request" };
    return response.status(status).json(body);
  }
  console.error(error);
  const body: ApiError = { error: "internal_error" };
  response.status(500).json(body);
}
