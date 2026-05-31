import express, { type Express } from "express";
import cors from "cors";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { healthRouter } from "./routes/health.js";
import { casesRouter } from "./routes/cases.js";
import { petitionsRouter } from "./routes/petitions.js";
import { analysesRouter } from "./routes/analyses.js";
import { receiptsRouter } from "./routes/receipts.js";
import { uploadsRouter } from "./routes/uploads.js";
import { settingsRouter } from "./routes/settings.js";
import { uscisSettingsRouter } from "./routes/uscisSettings.js";
import { openalexSettingsRouter } from "./routes/openalexSettings.js";
import { createAdminRouter } from "./routes/admin.js";
import { clerkAuth, requireClerkAuth } from "./middleware/clerk.js";
import { swaggerSpec } from "./swagger.js";

export function createApp(): Express {
  const app = express();

  app.use(
    cors({
      origin: (origin, cb) => cb(null, true),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("dev"));

  app.use(clerkAuth);

  app.use("/health", healthRouter);

  // OpenAPI docs — no auth required
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get("/openapi.json", (_req, res) => res.json(swaggerSpec));

  // Admin (bull-board) — no auth in demo mode; protect before going public
  app.use("/admin", createAdminRouter());

  // All other routes require auth
  app.use("/cases", requireClerkAuth, casesRouter);
  app.use("/petitions", requireClerkAuth, petitionsRouter);
  app.use("/analyses", requireClerkAuth, analysesRouter);
  app.use("/receipts", requireClerkAuth, receiptsRouter);
  app.use("/uploads", requireClerkAuth, uploadsRouter);
  app.use("/settings", requireClerkAuth, settingsRouter);
  app.use("/settings/uscis", requireClerkAuth, uscisSettingsRouter);
  app.use("/settings/openalex", requireClerkAuth, openalexSettingsRouter);

  // 404
  app.use((req, res) => {
    res.status(404).json({ error: `not found: ${req.method} ${req.path}` });
  });

  // Error handler
  app.use(
    (
      err: Error & { statusCode?: number; status?: number },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const status = err.statusCode ?? err.status ?? 500;
      if (status >= 500) console.error("[api] error:", err);
      res.status(status).json({ error: err.message ?? "internal server error" });
    },
  );

  return app;
}
