-- CreateEnum
CREATE TYPE "public"."Sex" AS ENUM ('M', 'F', 'Other', 'Unknown');

-- CreateEnum
CREATE TYPE "public"."MaritalStatus" AS ENUM ('single', 'married', 'divorced', 'widowed', 'other');

-- CreateEnum
CREATE TYPE "public"."WorkstationType" AS ENUM ('frontdesk', 'cashier', 'admin', 'lab', 'ultrasound', 'doctor_office');

-- CreateEnum
CREATE TYPE "public"."InvoiceStatus" AS ENUM ('draft', 'posted', 'void');

-- CreateEnum
CREATE TYPE "public"."ItemType" AS ENUM ('service', 'product');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('cash', 'card', 'transfer', 'other');

-- CreateEnum
CREATE TYPE "public"."TransferStatus" AS ENUM ('not_completed', 'completed');

-- CreateEnum
CREATE TYPE "public"."CashMovementType" AS ENUM ('sale', 'withdrawal', 'deposit', 'adjustment');

-- CreateEnum
CREATE TYPE "public"."StockReason" AS ENUM ('purchase', 'sale', 'adjustment', 'loss', 'return');

-- CreateEnum
CREATE TYPE "public"."AllergySeverity" AS ENUM ('mild', 'moderate', 'severe', 'unknown');

-- CreateEnum
CREATE TYPE "public"."ProblemStatus" AS ENUM ('active', 'resolved', 'remission', 'unknown');

-- CreateEnum
CREATE TYPE "public"."Route" AS ENUM ('oral', 'iv', 'im', 'sc', 'topical', 'other');

-- CreateEnum
CREATE TYPE "public"."Priority" AS ENUM ('routine', 'urgent', 'stat');

-- CreateEnum
CREATE TYPE "public"."LabOrderStatus" AS ENUM ('pending', 'in_progress', 'completed', 'canceled', 'partial');

-- CreateEnum
CREATE TYPE "public"."LabOrderTestStatus" AS ENUM ('pending', 'in_progress', 'completed', 'canceled');

-- CreateEnum
CREATE TYPE "public"."AbnormalFlag" AS ENUM ('H', 'L', 'N', 'A');

-- CreateEnum
CREATE TYPE "public"."OutOfRangeFlag" AS ENUM ('low', 'high');

-- CreateEnum
CREATE TYPE "public"."ConnectionType" AS ENUM ('serial', 'tcp', 'file', 'other');

-- CreateEnum
CREATE TYPE "public"."ProtocolKind" AS ENUM ('HL7', 'ASTM', 'CSV', 'TXT', 'JSON', 'Other');

-- CreateTable
CREATE TABLE "public"."roles" (
    "id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "description" VARCHAR(200),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(80) NOT NULL,
    "fullName" VARCHAR(120) NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "phone" VARCHAR(30),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_roles" (
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "public"."locations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "address" VARCHAR(200),

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cash_registers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "locationId" UUID NOT NULL,

    CONSTRAINT "cash_registers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pos_terminals" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "provider" VARCHAR(80) NOT NULL,
    "merchantId" VARCHAR(80),
    "locationId" UUID NOT NULL,

    CONSTRAINT "pos_terminals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workstations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "locationId" UUID NOT NULL,
    "type" "public"."WorkstationType" NOT NULL,
    "macAddress" VARCHAR(40),
    "allowedIpCidr" VARCHAR(64),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "workstations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."patients" (
    "id" UUID NOT NULL,
    "mrn" VARCHAR(40) NOT NULL,
    "nationalId" VARCHAR(40),
    "firstName" VARCHAR(80) NOT NULL,
    "lastName" VARCHAR(80) NOT NULL,
    "dob" DATE,
    "sex" "public"."Sex",
    "maritalStatus" "public"."MaritalStatus",
    "phone" VARCHAR(30),
    "email" VARCHAR(160),
    "address" VARCHAR(200),
    "city" VARCHAR(80),
    "region" VARCHAR(80),
    "country" VARCHAR(2),
    "bloodType" VARCHAR(3),
    "emergencyContactName" VARCHAR(120),
    "emergencyContactPhone" VARCHAR(30),
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."auth_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "ipAddress" VARCHAR(45) NOT NULL,
    "userAgent" VARCHAR(255) NOT NULL,
    "deviceFingerprint" VARCHAR(120),
    "workstationId" UUID,
    "geoCountry" VARCHAR(2),
    "geoRegion" VARCHAR(80),
    "geoCity" VARCHAR(80),
    "geoLat" DECIMAL(9,6),
    "geoLon" DECIMAL(9,6),
    "mfaPassed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."request_contexts" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" VARCHAR(45) NOT NULL,
    "userAgent" VARCHAR(255) NOT NULL,
    "deviceFingerprint" VARCHAR(120),
    "workstationId" UUID,
    "geoCountry" VARCHAR(2),
    "geoRegion" VARCHAR(80),
    "geoCity" VARCHAR(80),
    "geoLat" DECIMAL(9,6),
    "geoLon" DECIMAL(9,6),

    CONSTRAINT "request_contexts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."preclinic" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "bloodPressureSystolic" INTEGER,
    "bloodPressureDiastolic" INTEGER,
    "heartRate" INTEGER,
    "respRate" INTEGER,
    "temperatureC" DECIMAL(4,1),
    "weightKg" DECIMAL(6,2),
    "heightCm" DECIMAL(5,2),
    "bmi" DECIMAL(5,2),
    "chiefComplaint" VARCHAR(250),
    "currentMedications" VARCHAR(250),
    "diabetes" BOOLEAN,
    "hypertension" BOOLEAN,
    "otherConditions" VARCHAR(250),
    "allergiesReported" VARCHAR(250),
    "recordedById" UUID NOT NULL,
    "requestContextId" UUID NOT NULL,

    CONSTRAINT "preclinic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."allergies" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "substance" VARCHAR(120) NOT NULL,
    "reaction" VARCHAR(160),
    "severity" "public"."AllergySeverity",
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" UUID,

    CONSTRAINT "allergies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."problems" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "condition" VARCHAR(160) NOT NULL,
    "status" "public"."ProblemStatus" NOT NULL,
    "diagnosedAt" DATE,
    "resolvedAt" DATE,
    "recordedById" UUID,

    CONSTRAINT "problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."medications" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "drugName" VARCHAR(160) NOT NULL,
    "dose" VARCHAR(60),
    "frequency" VARCHAR(60),
    "route" "public"."Route",
    "startedAt" DATE,
    "stoppedAt" DATE,
    "prescribedById" UUID,

    CONSTRAINT "medications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."service_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."services" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "categoryId" UUID NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "taxRatePct" DECIMAL(5,2) NOT NULL,
    "commissionPct" DECIMAL(5,2),
    "requiresProvider" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."providers" (
    "id" UUID NOT NULL,
    "fullName" VARCHAR(120) NOT NULL,
    "specialty" VARCHAR(80),
    "defaultCommissionPct" DECIMAL(5,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."invoices" (
    "id" UUID NOT NULL,
    "invoiceNo" VARCHAR(30) NOT NULL,
    "patientId" UUID,
    "preclinicId" UUID,
    "status" "public"."InvoiceStatus" NOT NULL,
    "invoiceAt" TIMESTAMP(3) NOT NULL,
    "locationId" UUID NOT NULL,
    "cashierId" UUID NOT NULL,
    "registerId" UUID,
    "requestContextId" UUID NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discountTotal" DECIMAL(12,2) NOT NULL,
    "taxTotal" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."invoice_lines" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemType" "public"."ItemType" NOT NULL,
    "serviceId" UUID,
    "productId" UUID,
    "description" VARCHAR(200) NOT NULL,
    "qty" DECIMAL(10,2) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discountPct" DECIMAL(5,2) NOT NULL,
    "taxRatePct" DECIMAL(5,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "providerId" UUID,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."provider_commissions" (
    "id" UUID NOT NULL,
    "invoiceLineId" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "baseAmount" DECIMAL(12,2) NOT NULL,
    "ratePct" DECIMAL(5,2) NOT NULL,
    "commissionAmount" DECIMAL(12,2) NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "provider_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payments" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "method" "public"."PaymentMethod" NOT NULL,
    "transferStatus" "public"."TransferStatus",
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "exchangeRate" DECIMAL(12,6),
    "reference" VARCHAR(120),
    "posTerminalId" UUID,
    "createdById" UUID NOT NULL,
    "requestContextId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cash_sessions" (
    "id" UUID NOT NULL,
    "registerId" UUID NOT NULL,
    "openedById" UUID NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openingFloat" DECIMAL(12,2) NOT NULL,
    "closedById" UUID,
    "closedAt" TIMESTAMP(3),
    "declaredTotal" DECIMAL(12,2),
    "systemTotal" DECIMAL(12,2),
    "variance" DECIMAL(12,2),

    CONSTRAINT "cash_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cash_movements" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "type" "public"."CashMovementType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reference" VARCHAR(120),
    "createdById" UUID NOT NULL,
    "requestContextId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."inventory_products" (
    "id" UUID NOT NULL,
    "sku" VARCHAR(60) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "unit" VARCHAR(20),
    "price" DECIMAL(12,2) NOT NULL,
    "taxRatePct" DECIMAL(5,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "inventory_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."product_stock" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "onHand" INTEGER NOT NULL,

    CONSTRAINT "product_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stock_movements" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "qty" INTEGER NOT NULL,
    "reason" "public"."StockReason" NOT NULL,
    "reference" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."lab_instruments" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "vendor" VARCHAR(80),
    "model" VARCHAR(80),
    "serialNo" VARCHAR(80),
    "connectionType" "public"."ConnectionType",
    "locationId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "lab_instruments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."specimen_types" (
    "id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,

    CONSTRAINT "specimen_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."test_catalog" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "loincCode" VARCHAR(40),
    "units" VARCHAR(40),
    "specimenTypeId" UUID,
    "defaultInstrumentId" UUID,
    "isPanel" BOOLEAN NOT NULL DEFAULT false,
    "parentPanelId" UUID,

    CONSTRAINT "test_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reference_ranges" (
    "id" UUID NOT NULL,
    "testId" UUID NOT NULL,
    "sex" "public"."Sex",
    "ageMinYears" DECIMAL(5,2),
    "ageMaxYears" DECIMAL(5,2),
    "lowValue" DECIMAL(12,4),
    "highValue" DECIMAL(12,4),
    "notes" VARCHAR(200),

    CONSTRAINT "reference_ranges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."lab_orders" (
    "id" UUID NOT NULL,
    "accessionNo" VARCHAR(40) NOT NULL,
    "patientId" UUID NOT NULL,
    "orderingProviderId" UUID,
    "invoiceId" UUID,
    "preclinicId" UUID,
    "specimenTypeId" UUID,
    "collectionTime" TIMESTAMP(3),
    "collectedById" UUID,
    "priority" "public"."Priority",
    "status" "public"."LabOrderStatus" NOT NULL,
    "notes" VARCHAR(250),
    "requestContextId" UUID NOT NULL,

    CONSTRAINT "lab_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."lab_order_tests" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "testId" UUID NOT NULL,
    "status" "public"."LabOrderTestStatus" NOT NULL,
    "instrumentId" UUID,
    "analyteCodeInstrument" VARCHAR(60),
    "resultValue" DECIMAL(16,6),
    "resultText" VARCHAR(160),
    "units" VARCHAR(40),
    "flagAbnormal" "public"."AbnormalFlag",
    "outOfRange" "public"."OutOfRangeFlag",
    "referenceLow" DECIMAL(16,6),
    "referenceHigh" DECIMAL(16,6),
    "completedAt" TIMESTAMP(3),
    "resultNotes" VARCHAR(250),
    "requestContextId" UUID NOT NULL,

    CONSTRAINT "lab_order_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."lab_device_messages" (
    "id" UUID NOT NULL,
    "instrumentId" UUID NOT NULL,
    "orderId" UUID,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "protocol" "public"."ProtocolKind",
    "rawContent" TEXT NOT NULL,
    "parsedOk" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "lab_device_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."activity_log" (
    "id" UUID NOT NULL,
    "entity" VARCHAR(60) NOT NULL,
    "entityId" UUID NOT NULL,
    "action" VARCHAR(30) NOT NULL,
    "actorId" UUID NOT NULL,
    "requestContextId" UUID NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "public"."roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "patients_mrn_key" ON "public"."patients"("mrn");

-- CreateIndex
CREATE UNIQUE INDEX "services_code_key" ON "public"."services"("code");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNo_locationId_key" ON "public"."invoices"("invoiceNo", "locationId");

-- CreateIndex
CREATE INDEX "invoice_lines_invoiceId_idx" ON "public"."invoice_lines"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "provider_commissions_invoiceLineId_key" ON "public"."provider_commissions"("invoiceLineId");

-- CreateIndex
CREATE INDEX "payments_invoiceId_idx" ON "public"."payments"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_products_sku_key" ON "public"."inventory_products"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "product_stock_productId_locationId_key" ON "public"."product_stock"("productId", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "test_catalog_code_key" ON "public"."test_catalog"("code");

-- CreateIndex
CREATE UNIQUE INDEX "lab_orders_accessionNo_key" ON "public"."lab_orders"("accessionNo");

-- CreateIndex
CREATE INDEX "lab_order_tests_orderId_testId_idx" ON "public"."lab_order_tests"("orderId", "testId");

-- CreateIndex
CREATE INDEX "lab_device_messages_instrumentId_receivedAt_idx" ON "public"."lab_device_messages"("instrumentId", "receivedAt");

-- CreateIndex
CREATE INDEX "activity_log_entity_action_createdAt_idx" ON "public"."activity_log"("entity", "action", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cash_registers" ADD CONSTRAINT "cash_registers_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pos_terminals" ADD CONSTRAINT "pos_terminals_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workstations" ADD CONSTRAINT "workstations_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."patients" ADD CONSTRAINT "patients_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."auth_sessions" ADD CONSTRAINT "auth_sessions_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "public"."workstations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."request_contexts" ADD CONSTRAINT "request_contexts_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."auth_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."request_contexts" ADD CONSTRAINT "request_contexts_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "public"."workstations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."preclinic" ADD CONSTRAINT "preclinic_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."preclinic" ADD CONSTRAINT "preclinic_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."preclinic" ADD CONSTRAINT "preclinic_requestContextId_fkey" FOREIGN KEY ("requestContextId") REFERENCES "public"."request_contexts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."allergies" ADD CONSTRAINT "allergies_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."allergies" ADD CONSTRAINT "allergies_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."problems" ADD CONSTRAINT "problems_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."problems" ADD CONSTRAINT "problems_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."medications" ADD CONSTRAINT "medications_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."medications" ADD CONSTRAINT "medications_prescribedById_fkey" FOREIGN KEY ("prescribedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."services" ADD CONSTRAINT "services_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_preclinicId_fkey" FOREIGN KEY ("preclinicId") REFERENCES "public"."preclinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "public"."cash_registers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_requestContextId_fkey" FOREIGN KEY ("requestContextId") REFERENCES "public"."request_contexts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoice_lines" ADD CONSTRAINT "invoice_lines_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoice_lines" ADD CONSTRAINT "invoice_lines_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoice_lines" ADD CONSTRAINT "invoice_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."inventory_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoice_lines" ADD CONSTRAINT "invoice_lines_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "public"."providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."provider_commissions" ADD CONSTRAINT "provider_commissions_invoiceLineId_fkey" FOREIGN KEY ("invoiceLineId") REFERENCES "public"."invoice_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."provider_commissions" ADD CONSTRAINT "provider_commissions_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "public"."providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_posTerminalId_fkey" FOREIGN KEY ("posTerminalId") REFERENCES "public"."pos_terminals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_requestContextId_fkey" FOREIGN KEY ("requestContextId") REFERENCES "public"."request_contexts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cash_sessions" ADD CONSTRAINT "cash_sessions_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "public"."cash_registers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cash_sessions" ADD CONSTRAINT "cash_sessions_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cash_sessions" ADD CONSTRAINT "cash_sessions_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cash_movements" ADD CONSTRAINT "cash_movements_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cash_movements" ADD CONSTRAINT "cash_movements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cash_movements" ADD CONSTRAINT "cash_movements_requestContextId_fkey" FOREIGN KEY ("requestContextId") REFERENCES "public"."request_contexts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_stock" ADD CONSTRAINT "product_stock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."inventory_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_stock" ADD CONSTRAINT "product_stock_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_movements" ADD CONSTRAINT "stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."inventory_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_movements" ADD CONSTRAINT "stock_movements_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lab_instruments" ADD CONSTRAINT "lab_instruments_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."test_catalog" ADD CONSTRAINT "test_catalog_specimenTypeId_fkey" FOREIGN KEY ("specimenTypeId") REFERENCES "public"."specimen_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."test_catalog" ADD CONSTRAINT "test_catalog_defaultInstrumentId_fkey" FOREIGN KEY ("defaultInstrumentId") REFERENCES "public"."lab_instruments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."test_catalog" ADD CONSTRAINT "test_catalog_parentPanelId_fkey" FOREIGN KEY ("parentPanelId") REFERENCES "public"."test_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reference_ranges" ADD CONSTRAINT "reference_ranges_testId_fkey" FOREIGN KEY ("testId") REFERENCES "public"."test_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lab_orders" ADD CONSTRAINT "lab_orders_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lab_orders" ADD CONSTRAINT "lab_orders_orderingProviderId_fkey" FOREIGN KEY ("orderingProviderId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lab_orders" ADD CONSTRAINT "lab_orders_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lab_orders" ADD CONSTRAINT "lab_orders_preclinicId_fkey" FOREIGN KEY ("preclinicId") REFERENCES "public"."preclinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lab_orders" ADD CONSTRAINT "lab_orders_specimenTypeId_fkey" FOREIGN KEY ("specimenTypeId") REFERENCES "public"."specimen_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lab_orders" ADD CONSTRAINT "lab_orders_collectedById_fkey" FOREIGN KEY ("collectedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lab_orders" ADD CONSTRAINT "lab_orders_requestContextId_fkey" FOREIGN KEY ("requestContextId") REFERENCES "public"."request_contexts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lab_order_tests" ADD CONSTRAINT "lab_order_tests_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."lab_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lab_order_tests" ADD CONSTRAINT "lab_order_tests_testId_fkey" FOREIGN KEY ("testId") REFERENCES "public"."test_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lab_order_tests" ADD CONSTRAINT "lab_order_tests_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "public"."lab_instruments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lab_order_tests" ADD CONSTRAINT "lab_order_tests_requestContextId_fkey" FOREIGN KEY ("requestContextId") REFERENCES "public"."request_contexts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lab_device_messages" ADD CONSTRAINT "lab_device_messages_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "public"."lab_instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lab_device_messages" ADD CONSTRAINT "lab_device_messages_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."lab_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."activity_log" ADD CONSTRAINT "activity_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."activity_log" ADD CONSTRAINT "activity_log_requestContextId_fkey" FOREIGN KEY ("requestContextId") REFERENCES "public"."request_contexts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
