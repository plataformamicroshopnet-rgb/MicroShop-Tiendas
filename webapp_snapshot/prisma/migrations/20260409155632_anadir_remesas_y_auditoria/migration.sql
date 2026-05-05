-- CreateTable
CREATE TABLE "WorkPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "period_key" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "pymeMultiplier" REAL NOT NULL DEFAULT 5,
    "tramo1Limit" REAL NOT NULL DEFAULT 50,
    "tramo2Limit" REAL NOT NULL DEFAULT 80,
    "tramo3Limit" REAL NOT NULL DEFAULT 100,
    "visitasM1Contactos" REAL NOT NULL DEFAULT 25,
    "visitasM1Visitas" REAL NOT NULL DEFAULT 10,
    "visitasM2Contactos" REAL NOT NULL DEFAULT 55,
    "visitasM2Visitas" REAL NOT NULL DEFAULT 30,
    "visitasM3Contactos" REAL NOT NULL DEFAULT 90,
    "visitasM3Visitas" REAL NOT NULL DEFAULT 50
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CondicionPlus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "concepto" TEXT NOT NULL,
    "importeObj1" REAL NOT NULL DEFAULT 0,
    "importeObj2" REAL NOT NULL DEFAULT 0,
    "extrasTodaEmpresa" REAL NOT NULL DEFAULT 0,
    "objTodaEmpresa" REAL NOT NULL DEFAULT 0,
    "objetivo1" REAL NOT NULL DEFAULT 0,
    "objetivo2" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ImportePyme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "concepto" TEXT NOT NULL,
    "objetivoUds" REAL,
    "totalObjetivos" REAL,
    "objetivoPlus100" REAL,
    "comisionNacionalMenos50" REAL,
    "comisionNacionalEntre50Y80" REAL,
    "comisionNacionalEntre80Y100" REAL,
    "comisionNacionalMas100" REAL,
    "operacionesAsignadas" TEXT,
    "grupo" TEXT,
    "isPercentage" BOOLEAN NOT NULL DEFAULT false,
    "periodId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImportePyme_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "WorkPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportePlus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "concepto" TEXT NOT NULL,
    "objetivoUds" REAL,
    "totalObjetivos" REAL,
    "objetivoPlus100" REAL,
    "comisionNacionalMenos50" REAL,
    "comisionNacionalEntre50Y80" REAL,
    "comisionNacionalEntre80Y100" REAL,
    "comisionNacionalMas100" REAL,
    "operacionesAsignadas" TEXT,
    "grupo" TEXT,
    "isPercentage" BOOLEAN NOT NULL DEFAULT false,
    "periodId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImportePlus_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "WorkPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgendaEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigoComercial" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL,
    "ventas" INTEGER NOT NULL DEFAULT 0,
    "visitas" INTEGER NOT NULL DEFAULT 0,
    "teams" INTEGER NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
    "observaciones" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Magazine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "description" TEXT,
    "pdfUrl" TEXT NOT NULL,
    "coverUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MagazineView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "magazineId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pageViews" TEXT,
    CONSTRAINT "MagazineView_magazineId_fkey" FOREIGN KEY ("magazineId") REFERENCES "Magazine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrackingPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TrackingGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "pymeVal" REAL,
    "basicoVal" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrackingGroup_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "TrackingPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrackingRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "comercialName" TEXT NOT NULL,
    "objectiveMonth" REAL NOT NULL DEFAULT 0,
    "week1" REAL NOT NULL DEFAULT 0,
    "week2" REAL NOT NULL DEFAULT 0,
    "week3" REAL NOT NULL DEFAULT 0,
    "week4" REAL NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrackingRow_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TrackingGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MonthlyCondition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "amount" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExtraRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "channelType" TEXT NOT NULL,
    "description" TEXT,
    "combinationLabel" TEXT NOT NULL,
    "requiredGroups" TEXT NOT NULL,
    "payoutMode" TEXT NOT NULL,
    "sameClientRequired" BOOLEAN NOT NULL DEFAULT true,
    "sameSellerRequired" BOOLEAN NOT NULL DEFAULT true,
    "minOccurrences" INTEGER NOT NULL DEFAULT 1,
    "maxPayoutUnits" INTEGER,
    "telecomRewardAmount" REAL NOT NULL DEFAULT 0,
    "sellerRewardAmount" REAL NOT NULL DEFAULT 0,
    "validFrom" DATETIME,
    "validTo" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "periodId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExtraRule_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "WorkPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExtraAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleId" TEXT,
    "periodId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "seller" TEXT NOT NULL,
    "sellerId" TEXT,
    "customerNif" TEXT,
    "customerName" TEXT,
    "triggerKey" TEXT NOT NULL,
    "triggerSummary" TEXT,
    "sourceSaleIds" TEXT,
    "telecomRewardAmount" REAL NOT NULL,
    "sellerRewardAmount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExtraAssignment_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ExtraRule" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ExtraAssignment_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "WorkPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ManualExtraTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "channelType" TEXT NOT NULL,
    "defaultAmount" REAL NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "username" TEXT,
    "role" TEXT,
    "path" TEXT NOT NULL,
    "action" TEXT DEFAULT 'VIEW',
    "device" TEXT DEFAULT 'DESKTOP',
    "errorDetails" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TopRouteHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "views" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TopUserHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "sessions" INTEGER NOT NULL,
    "actions" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "VentaLibroMayor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fechaVenta" DATETIME NOT NULL,
    "origen" TEXT NOT NULL,
    "nifCliente" TEXT NOT NULL,
    "producto" TEXT NOT NULL,
    "comisionEsperada" REAL NOT NULL,
    "estadoPago" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "liquidacionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VentaLibroMayor_liquidacionId_fkey" FOREIGN KEY ("liquidacionId") REFERENCES "LiquidacionTelef" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RemesaTelefonica" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombreArchivo" TEXT NOT NULL,
    "mesLiquidacion" TEXT NOT NULL,
    "concepto" TEXT,
    "fechaSubida" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalImporte" REAL NOT NULL,
    "totalLineas" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LiquidacionTelef" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fechaLiquidacion" DATETIME NOT NULL,
    "nifCliente" TEXT NOT NULL,
    "productoLiquidado" TEXT NOT NULL,
    "importePagado" REAL NOT NULL,
    "remesaId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LiquidacionTelef_remesaId_fkey" FOREIGN KEY ("remesaId") REFERENCES "RemesaTelefonica" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Objective" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profile" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "objKey" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "grupo" TEXT,
    "periodId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Objective_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "WorkPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Objective" ("createdAt", "id", "month", "objKey", "profile", "updatedAt", "value") SELECT "createdAt", "id", "month", "objKey", "profile", "updatedAt", "value" FROM "Objective";
DROP TABLE "Objective";
ALTER TABLE "new_Objective" RENAME TO "Objective";
CREATE TABLE "new_ProductCatalog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoria" TEXT NOT NULL,
    "producto" TEXT NOT NULL,
    "mensual" TEXT NOT NULL,
    "anual" TEXT NOT NULL,
    "validFrom" TEXT,
    "validTo" TEXT,
    "periodId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductCatalog_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "WorkPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProductCatalog" ("anual", "categoria", "createdAt", "id", "mensual", "producto", "updatedAt") SELECT "anual", "categoria", "createdAt", "id", "mensual", "producto", "updatedAt" FROM "ProductCatalog";
DROP TABLE "ProductCatalog";
ALTER TABLE "new_ProductCatalog" RENAME TO "ProductCatalog";
CREATE TABLE "new_Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sheet" TEXT NOT NULL,
    "vendedor" TEXT NOT NULL,
    "fecha" TEXT NOT NULL,
    "codigo" TEXT,
    "producto" TEXT,
    "nif" TEXT,
    "nombreCliente" TEXT,
    "potencial" TEXT,
    "telf" TEXT,
    "pendiente" TEXT,
    "anulado" TEXT,
    "anotaciones" TEXT,
    "grupo" TEXT,
    "cuota" REAL,
    "detalle" TEXT,
    "periodId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Sale_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "WorkPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Sale" ("anotaciones", "anulado", "codigo", "createdAt", "cuota", "detalle", "fecha", "id", "nif", "pendiente", "potencial", "producto", "sheet", "telf", "updatedAt", "vendedor") SELECT "anotaciones", "anulado", "codigo", "createdAt", "cuota", "detalle", "fecha", "id", "nif", "pendiente", "potencial", "producto", "sheet", "telf", "updatedAt", "vendedor" FROM "Sale";
DROP TABLE "Sale";
ALTER TABLE "new_Sale" RENAME TO "Sale";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "WorkPeriod_period_key_key" ON "WorkPeriod"("period_key");

-- CreateIndex
CREATE UNIQUE INDEX "WorkPeriod_year_month_key" ON "WorkPeriod"("year", "month");

-- CreateIndex
CREATE INDEX "AgendaEntry_fecha_idx" ON "AgendaEntry"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "AgendaEntry_codigoComercial_fecha_key" ON "AgendaEntry"("codigoComercial", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "Magazine_slug_key" ON "Magazine"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingPeriod_month_year_key" ON "TrackingPeriod"("month", "year");

-- CreateIndex
CREATE INDEX "MonthlyCondition_periodKey_idx" ON "MonthlyCondition"("periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "ExtraAssignment_triggerKey_key" ON "ExtraAssignment"("triggerKey");

-- CreateIndex
CREATE INDEX "ExtraAssignment_periodId_seller_idx" ON "ExtraAssignment"("periodId", "seller");

-- CreateIndex
CREATE INDEX "UserActivity_username_idx" ON "UserActivity"("username");

-- CreateIndex
CREATE INDEX "UserActivity_createdAt_idx" ON "UserActivity"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TopRouteHistory_month_year_path_key" ON "TopRouteHistory"("month", "year", "path");

-- CreateIndex
CREATE UNIQUE INDEX "TopUserHistory_month_year_username_key" ON "TopUserHistory"("month", "year", "username");

-- CreateIndex
CREATE INDEX "VentaLibroMayor_nifCliente_idx" ON "VentaLibroMayor"("nifCliente");

-- CreateIndex
CREATE INDEX "LiquidacionTelef_nifCliente_idx" ON "LiquidacionTelef"("nifCliente");
