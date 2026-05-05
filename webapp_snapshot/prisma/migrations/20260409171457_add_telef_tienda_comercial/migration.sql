-- AlterTable
ALTER TABLE "LiquidacionTelef" ADD COLUMN "comercial" TEXT;
ALTER TABLE "LiquidacionTelef" ADD COLUMN "tienda" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RemesaTelefonica" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombreArchivo" TEXT NOT NULL,
    "mesLiquidacion" TEXT NOT NULL,
    "concepto" TEXT,
    "fechaSubida" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalImporte" REAL NOT NULL,
    "totalLineas" INTEGER NOT NULL,
    "esTotal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_RemesaTelefonica" ("concepto", "createdAt", "fechaSubida", "id", "mesLiquidacion", "nombreArchivo", "totalImporte", "totalLineas", "updatedAt") SELECT "concepto", "createdAt", "fechaSubida", "id", "mesLiquidacion", "nombreArchivo", "totalImporte", "totalLineas", "updatedAt" FROM "RemesaTelefonica";
DROP TABLE "RemesaTelefonica";
ALTER TABLE "new_RemesaTelefonica" RENAME TO "RemesaTelefonica";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
