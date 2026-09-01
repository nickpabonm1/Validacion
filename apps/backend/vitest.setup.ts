import path from "node:path";

// Debe ejecutarse ANTES de que cualquier módulo importe ./src/config/env (que valida
// APP_ENCRYPTION_KEY al cargarse). Llave de prueba fija, sin uso fuera de este entorno.
process.env.APP_ENCRYPTION_KEY = "/L2TFDOmPv1VIZak27bmXmUWXmsLixRWVnvyeaJsmUk=";
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = `file:${path.resolve(__dirname, "..", "..", "prisma", "test.db")}`;
