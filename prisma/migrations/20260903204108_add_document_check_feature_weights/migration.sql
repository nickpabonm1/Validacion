-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_document_check_scoring_config" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "categoryWeights" TEXT NOT NULL DEFAULT '{}',
    "featureWeights" TEXT NOT NULL DEFAULT '{}',
    "passThreshold" INTEGER,
    "treatNotDoneAsFailure" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_document_check_scoring_config" ("categoryWeights", "id", "passThreshold", "treatNotDoneAsFailure", "updatedAt") SELECT "categoryWeights", "id", "passThreshold", "treatNotDoneAsFailure", "updatedAt" FROM "document_check_scoring_config";
DROP TABLE "document_check_scoring_config";
ALTER TABLE "new_document_check_scoring_config" RENAME TO "document_check_scoring_config";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
