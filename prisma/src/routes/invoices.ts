// prisma/src/routes/invoices.ts
import { Router } from "@oak/oak";
import { PrismaClient } from "../generated/prisma/index.js";
import type { AuthState } from "../types.ts";
import { requireRoles } from "../mw/roleGuard.ts";

const prisma = new PrismaClient();
export const invoicesRouter = new Router<AuthState>();

// ----------------- Helpers -----------------
function badRequest(ctx: any, message: string, details?: unknown) {
    ctx.response.status = 400;
    ctx.response.body = { error: "bad_request", message, details };
}
function notFound(ctx: any, message = "not found") {
    ctx.response.status = 404;
    ctx.response.body = { error: "not_found", message };
}
function unauthorized(ctx: any) {
    ctx.response.status = 401;
    ctx.response.body = { error: "unauthorized" };
}
async function createRequestContext(prisma: PrismaClient, userId: string, ctx: any) {
    const ipAddress = ctx.request.headers.get("x-forwarded-for") ?? ctx.request.ip ?? "127.0.0.1";
    const userAgent = ctx.request.headers.get("user-agent") ?? "unknown";
    return prisma.requestContext.create({
        data: { session: { create: { userId, ipAddress, userAgent } }, ipAddress, userAgent },
    });
}
const dec = (n: number | string) => (typeof n === "number" ? n.toFixed(2) : String(n));

// ----------------- Totals recalculation -----------------
async function recalcTotals(invoiceId: string) {
    const lines = await prisma.invoiceLine.findMany({ where: { invoiceId } });
    let subtotal = 0, discountTotal = 0, taxTotal = 0, total = 0;

    for (const L of lines) {
        const qty = Number(L.qty);
        const price = Number(L.unitPrice);
        const discPct = Number(L.discountPct ?? 0);
        const taxPct = Number(L.taxRatePct ?? 0);

        const base = qty * price;
        const disc = base * (discPct / 100);
        const afterDisc = base - disc;
        const tax = afterDisc * (taxPct / 100);
        const lineTotal = afterDisc + tax;

        subtotal += base;
        discountTotal += disc;
        taxTotal += tax;
        total += lineTotal;
    }

    return prisma.invoice.update({
        where: { id: invoiceId },
        data: {
            subtotal: dec(subtotal),
            discountTotal: dec(discountTotal),
            taxTotal: dec(taxTotal),
            total: dec(total),
        },
    });
}

// ----------------- Routes -----------------

// Create draft invoice (cashier, super_admin)
invoicesRouter.post(
    "/api/invoices",
    requireRoles(["cashier", "super_admin"]),
    async (ctx) => {
        const auth = ctx.state.auth;
        if (!auth?.user?.id) return unauthorized(ctx);

        const body = await ctx.request.body.json().catch(() => ({} as any));
        const { patientId, preclinicId, locationId, registerId, invoiceNo } = body ?? {};
        if (!locationId) return badRequest(ctx, "locationId is required");

        const rc = await createRequestContext(prisma, auth.user.id, ctx);
        const created = await prisma.invoice.create({
            data: {
                invoiceNo: invoiceNo ?? `DRAFT-${Date.now()}`,
                patientId: patientId ?? null,
                preclinicId: preclinicId ?? null,
                status: "draft",
                invoiceAt: new Date(),
                locationId,
                cashierId: auth.user.id,
                registerId: registerId ?? null,
                requestContextId: rc.id,
                subtotal: "0.00",
                discountTotal: "0.00",
                taxTotal: "0.00",
                total: "0.00",
            },
        });
        ctx.response.status = 201;
        ctx.response.body = created;
    },
);

// Get invoice
invoicesRouter.get(
    "/api/invoices/:id",
    requireRoles(["cashier", "admin", "super_admin"]),
    async (ctx) => {
        const id = ctx.params.id!;
        const inv = await prisma.invoice.findUnique({
            where: { id },
            include: { lines: true, payments: true, patient: true, preclinic: true },
        });
        if (!inv) return notFound(ctx, "invoice not found");
        ctx.response.body = inv;
    },
);

// List invoices (cursor)
invoicesRouter.get(
    "/api/invoices",
    requireRoles(["cashier", "admin", "super_admin"]),
    async (ctx) => {
        const limit = Math.min(50, Math.max(1, Number(ctx.request.url.searchParams.get("limit") ?? 20)));
        const cursor = ctx.request.url.searchParams.get("cursor") ?? undefined;

        const page = await prisma.invoice.findMany({
            take: limit + 1,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
            orderBy: { invoiceAt: "desc" },
            select: { id: true, invoiceNo: true, status: true, total: true, invoiceAt: true },
        });

        const nextCursor = page.length > limit ? page[limit].id : null;
        ctx.response.body = { items: page.slice(0, limit), nextCursor };
    },
);

// Add line
invoicesRouter.post(
    "/api/invoices/:id/lines",
    requireRoles(["cashier", "super_admin"]),
    async (ctx) => {
        const id = ctx.params.id!;
        const auth = ctx.state.auth;
        if (!auth?.user?.id) return unauthorized(ctx);

        const invoice = await prisma.invoice.findUnique({ where: { id } });
        if (!invoice) return notFound(ctx, "invoice not found");
        if (invoice.status !== "draft") return badRequest(ctx, "Only draft invoices can be edited");

        const b = await ctx.request.body.json().catch(() => ({} as any));
        const {
            itemType, serviceId, productId, description,
            qty, unitPrice, discountPct = 0, taxRatePct = 0, providerId,
        } = b;

        if (!["service", "product"].includes(itemType)) {
            return badRequest(ctx, "itemType must be service|product");
        }
        if (itemType === "service" && !serviceId) return badRequest(ctx, "serviceId required for service items");
        if (itemType === "product" && !productId) return badRequest(ctx, "productId required for product items");
        if (!qty || !unitPrice) return badRequest(ctx, "qty and unitPrice are required");

        const lineNo = (await prisma.invoiceLine.count({ where: { invoiceId: id } })) + 1;

        await prisma.invoiceLine.create({
            data: {
                invoiceId: id,
                lineNo,
                itemType,
                serviceId: serviceId ?? null,
                productId: productId ?? null,
                description: description ?? "",
                qty: dec(qty),
                unitPrice: dec(unitPrice),
                discountPct: dec(discountPct),
                taxRatePct: dec(taxRatePct),
                lineTotal: "0.00", // recalculated below
                providerId: providerId ?? null,
            },
        });

        const updatedInvoice = await recalcTotals(id);
        ctx.response.status = 201;
        ctx.response.body = updatedInvoice;
    },
);

// Post invoice
invoicesRouter.post(
    "/api/invoices/:id/post",
    requireRoles(["cashier", "super_admin"]),
    async (ctx) => {
        const id = ctx.params.id!;
        const auth = ctx.state.auth;
        if (!auth?.user?.id) return unauthorized(ctx);

        const inv = await prisma.invoice.findUnique({ where: { id }, include: { lines: true } });
        if (!inv) return notFound(ctx, "invoice not found");
        if (inv.status !== "draft") return badRequest(ctx, "Invoice is not draft");
        if (!inv.lines.length) return badRequest(ctx, "Invoice has no lines");

        await recalcTotals(id);
        const posted = await prisma.invoice.update({
            where: { id },
            data: { status: "posted", invoiceAt: new Date() },
        });

        ctx.response.body = posted;
    },
);

// Void invoice
invoicesRouter.post(
    "/api/invoices/:id/void",
    requireRoles(["admin", "super_admin"]),
    async (ctx) => {
        const id = ctx.params.id!;
        const inv = await prisma.invoice.findUnique({ where: { id } });
        if (!inv) return notFound(ctx, "invoice not found");
        if (inv.status === "void") return badRequest(ctx, "Already void");
        const voided = await prisma.invoice.update({ where: { id }, data: { status: "void" } });
        ctx.response.body = voided;
    },
);

// ✅ renamed to avoid duplicate route collision
invoicesRouter.get(
    "/api/invoices_legacy",
    requireRoles(["cashier", "admin", "super_admin"]),
    async (ctx) => {
        const qp = ctx.request.url.searchParams;
        const status = qp.get("status") ?? undefined;
        const from = qp.get("from") ? new Date(qp.get("from")!) : undefined;
        const to = qp.get("to") ? new Date(qp.get("to")!) : undefined;
        const limit = Math.min(Number(qp.get("limit") ?? 50), 200);

        const where: any = {};
        if (status) where.status = status; // draft|posted|void
        if (from || to) {
            where.invoiceAt = {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
            };
        }

        const items = await prisma.invoice.findMany({
            where,
            take: limit,
            orderBy: { invoiceAt: "desc" },
            include: {
                patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
                location: { select: { id: true, name: true } },
                payments: true,
            },
        });

        ctx.response.body = items;
    },
);

// --- Create payment for invoice (LEGACY) ----------------------------------
// POST /api/invoices/:id/payments { method, amount, currency, reference?, posTerminalId? }
// ✅ renamed to avoid duplicate route collision
invoicesRouter.post(
    "/api/invoices/:id/payments_legacy",
    requireRoles(["cashier", "admin", "super_admin"]),
    async (ctx) => {
        const auth = ctx.state.auth;
        if (!auth?.user?.id) return unauthorized(ctx);

        const invoiceId = ctx.params.id!;
        const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
        if (!inv) return notFound(ctx, "invoice not found");

        let body: any;
        try { body = await ctx.request.body.json(); } catch { return badRequest(ctx, "Invalid JSON"); }

        const { method, amount, currency, reference, posTerminalId } = body ?? {};
        if (!method || !["cash","card","transfer","other"].includes(method)) {
            return badRequest(ctx, "method must be one of: cash|card|transfer|other");
        }
        const nAmt = Number(amount);
        if (!isFinite(nAmt) || nAmt <= 0) return badRequest(ctx, "amount must be a positive number");
        const cur = String(currency ?? "HNL");

        const reqCtx = await prisma.requestContext.create({
            data: {
                session: { create: { userId: auth.user.id, ipAddress: ctx.request.ip ?? "127.0.0.1", userAgent: ctx.request.headers.get("user-agent") ?? "unknown" } },
                ipAddress: ctx.request.ip ?? "127.0.0.1",
                userAgent: ctx.request.headers.get("user-agent") ?? "unknown",
            },
        });

        const created = await prisma.payment.create({
            data: {
                invoiceId,
                method,
                transferStatus: method === "transfer" ? "not_completed" : null,
                amount: nAmt.toFixed(2),
                currency: cur,
                reference: reference ?? null,
                posTerminalId: posTerminalId ?? null,
                createdById: auth.user.id,
                requestContextId: reqCtx.id,
            },
        });

        ctx.response.status = 201;
        ctx.response.body = created;
    },
);

// --- Printable PDF (placeholder implementation) ---------------------------
// GET /api/invoices/:id/print  -> returns application/pdf
invoicesRouter.get(
    "/api/invoices/:id/print",
    requireRoles(["cashier", "admin", "super_admin"]),
    async (ctx) => {
        const id = ctx.params.id!;
        const inv = await prisma.invoice.findUnique({
            where: { id },
            include: {
                patient: true,
                location: true,
                lines: {
                    include: {
                        service: true,
                        product: true,
                    }
                },
                payments: true,
            },
        });
        if (!inv) return notFound(ctx, "invoice not found");

        // Minimal PDF (you can replace with a real template engine later)
        const pdfContent = `%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R>> endobj
4 0 obj <</Length 1000>> stream
BT
/F1 12 Tf
50 780 Td (Factura: ${inv.invoiceNo}) Tj
0 -18 Td (Estado: ${inv.status}) Tj
0 -18 Td (Paciente: ${(inv.patient?.firstName ?? "")} ${(inv.patient?.lastName ?? "")}) Tj
0 -18 Td (Fecha: ${inv.invoiceAt.toISOString()}) Tj
0 -18 Td (Total: ${inv.total}) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000111 00000 n 
0000000220 00000 n 
trailer <</Root 1 0 R /Size 5>>
startxref
340
%%EOF`;

        const bytes = new TextEncoder().encode(pdfContent);
        ctx.response.status = 200;
        ctx.response.headers.set("content-type", "application/pdf");
        ctx.response.headers.set("content-disposition", `inline; filename="invoice-${id}.pdf"`);
        ctx.response.body = bytes;
    },
);

// Take a payment — cash-first, coupled to an open cash session
invoicesRouter.post(
    "/api/invoices/:id/payments",
    requireRoles(["cashier", "super_admin"]),
    async (ctx) => {
        const auth = ctx.state.auth;
        if (!auth?.user?.id) return unauthorized(ctx);
        const invoiceId = ctx.params.id!;

        const inv = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: { payments: true },
        });
        if (!inv) return notFound(ctx, "invoice not found");
        if (inv.status !== "posted") return badRequest(ctx, "Only posted invoices can be paid");

        const b = await ctx.request.body.json().catch(() => ({} as any));
        const method = String(b.method ?? "");
        const amount = Number(b.amount);
        const amountTendered = b.amountTendered != null ? Number(b.amountTendered) : amount;
        const sessionId = b.sessionId as string | undefined;
        const currency = (b.currency as string) ?? "HNL";
        const reference = (b.reference as string) ?? null;
        const posTerminalId = (b.posTerminalId as string) ?? null;
        const transferStatus = (b.transferStatus as string) ?? null;

        const validMethods = ["cash", "card", "transfer", "other"];
        if (!validMethods.includes(method)) {
            return badRequest(ctx, `method must be one of ${validMethods.join("|")}`);
        }
        if (!isFinite(amount) || amount <= 0) {
            return badRequest(ctx, "amount must be > 0");
        }

        // Outstanding balance
        const paidSoFar = (inv.payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
        const outstanding = Number(inv.total) - paidSoFar;
        if (amount > outstanding + 1e-6) {
            return badRequest(ctx, "amount exceeds outstanding balance", { outstanding });
        }

        // If cash, require an OPEN cash session and couple a movement
        let session: { id: string; registerId: string | null; closedAt: Date | null } | null = null;
        if (method === "cash") {
            if (!sessionId) return badRequest(ctx, "sessionId is required for cash payments");

            // ✅ updated: select registerId so we can link invoice.registerId too
            session = await prisma.cashSession.findUnique({
                where: { id: sessionId },
                select: { id: true, registerId: true, closedAt: true },
            });

            if (!session) return badRequest(ctx, "cash session not found", { sessionId });
            if (session.closedAt) return badRequest(ctx, "cash session is closed");
        }

        // Request context
        const rc = await createRequestContext(prisma, auth.user.id, ctx);

        const appliedAmount = Math.min(amount, outstanding);
        const change = Math.max(0, Number(amountTendered ?? appliedAmount) - appliedAmount);

        // Atomic payment + (optional) cash movement
        const result = await prisma.$transaction(async (tx) => {
            const payment = await tx.payment.create({
                data: {
                    invoiceId,
                    method,
                    transferStatus: method === "transfer" ? transferStatus : null,
                    amount: dec(appliedAmount),
                    currency,
                    reference,
                    posTerminalId: method === "card" ? posTerminalId : null,
                    createdById: auth.user.id,
                    requestContextId: rc.id,
                },
            });

            let movement: any = null;
            if (method === "cash") {
                movement = await tx.cashMovement.create({
                    data: {
                        sessionId: session!.id,
                        type: "sale",
                        amount: dec(appliedAmount),
                        reference: `PAY:${payment.id}`, // soft-link for reconciliation
                        createdById: auth.user.id,
                        requestContextId: rc.id,
                    },
                });

                // ✅ NEW: link invoice to cash session + register for reconciliation
                await tx.invoice.update({
                    where: { id: invoiceId },
                    data: {
                        cashSessionId: session!.id,
                        registerId: session!.registerId ?? null,
                    },
                });
            }

            return { payment, movement };
        });

        const outstandingAfter = outstanding - appliedAmount;

        ctx.response.status = 201;
        ctx.response.body = {
            ok: true,
            payment: result.payment,
            movement: result.movement, // null for non-cash methods
            appliedAmount,
            amountTendered,
            change,
            outstandingBefore: outstanding,
            outstandingAfter,
        };
    },
);