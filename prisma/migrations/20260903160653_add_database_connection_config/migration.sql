-- CreateTable
CREATE TABLE "database_connection_config" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "engine" TEXT NOT NULL DEFAULT 'SQLITE',
    "host" TEXT,
    "port" INTEGER,
    "databaseName" TEXT,
    "username" TEXT,
    "passwordEnc" TEXT,
    "ssl" BOOLEAN NOT NULL DEFAULT true,
    "connectionUri" TEXT,
    "updatedAt" DATETIME NOT NULL
);
