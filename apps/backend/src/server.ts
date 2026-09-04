import { env } from "./config/env";
import { createApp } from "./app";
import { logger } from "./lib/logger";

const app = createApp();

app.listen(env.port, () => {
  logger.info(`Biometric Console backend escuchando en el puerto ${env.port} (${env.nodeEnv})`);
});
