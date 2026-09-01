import "./config/env";
import path from "node:path";
import fs from "node:fs";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { attachUser } from "./modules/auth/auth.middleware";
import { authRouter } from "./modules/auth/auth.routes";
import { usersRouter } from "./modules/users/users.routes";
import { environmentsRouter } from "./modules/environments/environments.routes";
import { providersRouter } from "./modules/providers/providers.routes";
import { templatesRouter } from "./modules/templates/templates.routes";
import { executionsRouter } from "./modules/executions/executions.routes";
import { webhooksPublicRouter, webhooksRouter } from "./modules/webhooks/webhooks.routes";
import { responseViewsRouter } from "./modules/response-views/response-views.routes";
import { auditRouter } from "./modules/audit/audit.routes";
import { settingsRouter } from "./modules/settings/settings.routes";
import { mediaProxyRouter } from "./modules/media-proxy/media-proxy.routes";
import { errorHandler, notFoundHandler } from "./lib/errors";

export function createApp(): express.Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: "same-site" },
    }),
  );
  app.use(
    cors({
      origin: env.isProduction ? env.corsOrigin : true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());
  app.use(attachUser);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/environments", environmentsRouter);
  app.use("/api/providers", providersRouter);
  app.use("/api/templates", templatesRouter);
  app.use("/api/executions", executionsRouter);
  app.use("/api/webhooks", webhooksPublicRouter);
  app.use("/api/webhooks", webhooksRouter);
  app.use("/api/response-views", responseViewsRouter);
  app.use("/api/audit", auditRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/media-proxy", mediaProxyRouter);

  // El frontend compilado (apps/frontend/dist) se sirve desde el propio backend en producción
  // para simplificar el despliegue a un único proceso Node.
  const frontendDist = path.resolve(__dirname, "..", "..", "frontend", "dist");
  if (env.isProduction && fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(frontendDist, "index.html"));
    });
  }

  app.use("/api", notFoundHandler);
  app.use(errorHandler);

  return app;
}
