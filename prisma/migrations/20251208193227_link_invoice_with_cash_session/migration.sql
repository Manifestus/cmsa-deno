/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `cash_registers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `locations` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `pos_terminals` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[fullName]` on the table `providers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `specimen_types` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `workstations` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."ExpenseType" AS ENUM ('purchase', 'bank_deposit', 'other');

-- AlterTable
ALTER TABLE "public"."cash_movements" ADD COLUMN     "expenseType" "public"."ExpenseType";

-- AlterTable
ALTER TABLE "public"."invoices" ADD COLUMN     "cashSessionId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "cash_registers_name_key" ON "public"."cash_registers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "locations_name_key" ON "public"."locations"("name");

-- CreateIndex
CREATE UNIQUE INDEX "pos_terminals_name_key" ON "public"."pos_terminals"("name");

-- CreateIndex
CREATE UNIQUE INDEX "providers_fullName_key" ON "public"."providers"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "specimen_types_name_key" ON "public"."specimen_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "workstations_name_key" ON "public"."workstations"("name");

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "public"."cash_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
