-- CreateTable
CREATE TABLE "document_check_scoring_config" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "categoryWeights" TEXT NOT NULL DEFAULT '{}',
    "passThreshold" INTEGER,
    "updatedAt" DATETIME NOT NULL
);
