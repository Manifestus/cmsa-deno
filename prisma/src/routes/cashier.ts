import { Router } from "@oak/oak";
import type { AuthState } from "../types.ts";
import { requireRoles } from "../mw/roleGuard.ts";
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();
export const cashierRouter = new Router<AuthState>();

// ---------- helpers ----------
function badRequest(ctx: any, message: string, details?: unknown) {
    ctx.response.status = 400;
    ctx.response.body = { error: "bad_request", message, details };
}
function unauthorized(ctx: any, message = "unauthorized") {
    ctx.response.status = 401;
    ctx.response.body = { error: "unauthorized", message };
}
function forbidden(ctx: any, message = "forbidden") {
    ctx.response.status = 403;
    ctx.response.body = { error: "forbidden", message };
}
function notFound(ctx: any, message = "not_found") {
    ctx.response.status = 404;
    ctx.response.body = { error: "not_found", message };
}

// ---------- request context ----------
async function createRequestContext(prisma: PrismaClient, userId: string, ctx: any) {
    const ipAddress =
        (ctx.request.ip as string | undefined) ??
        ctx.request.headers.get("x-forwarded-for") ??
        "127.0.0.1";

    const userAgent = ctx.request.headers.get("user-agent") ?? "unknown";

    // Create AuthSession + RequestContext in one shot
    const rc = await prisma.requestContext.create({
        data: {
            session: {
                create: {
                    userId,
                    ipAddress,
                    userAgent,
                },
            },
            ipAddress,
            userAgent,
        },
    });

    return rc;
}

// ---------- validations ----------
type OpenSessionInput = {
    registerId: string;
    openingFloat: number;
};

function parseOpenSession(body: unknown): OpenSessionInput | { error: string } {
    if (!body || typeof body !== "object") return { error: "Body must be an object" };
    const b = body as Record<string, unknown>;
    const registerId = String(b.registerId ?? "");
    const openingFloat = Number(b.openingFloat);

    if (!registerId) return { error: "registerId is required" };
    if (!isFinite(openingFloat) || openingFloat < 0) {
        return { error: "openingFloat must be a non-negative number" };
    }
    return { registerId, openingFloat };
}

type CloseSessionInput = {
    declaredTotal: number;
};

function parseCloseSession(body: unknown): CloseSessionInput | { error: string } {
    if (!body || typeof body !== "object") return { error: "Body must be an object" };
    const b = body as Record<string, unknown>;
    const declaredTotal = Number(b.declaredTotal);
    if (!isFinite(declaredTotal) || declaredTotal < 0) {
        return { error: "declaredTotal must be a non-negative number" };
    }
    return { declaredTotal };
}

type CashMovementInput = {
    sessionId: string;
    type: "sale" | "withdrawal" | "deposit" | "adjustment";
    amount: number;
    reference?: string;
    expenseType?: "purchase" | "bank_deposit" | "other";
};

function parseCashMovement(body: unknown): CashMovementInput | { error: string; details?: unknown } {
    if (!body || typeof body !== "object") return { error: "Body must be a JSON object" };
    const b = body as Record<string, unknown>;

    const sessionId = String(b.sessionId ?? "");
    const type = String(b.type ?? "");
    const amountRaw = b.amount;

    if (!sessionId) return { error: "sessionId is required" };
    if (!["sale", "withdrawal", "deposit", "adjustment"].includes(type)) {
        return { error: "type must be one of: sale, withdrawal, deposit, adjustment" };
    }
    if (typeof amountRaw !== "number" || !isFinite(amountRaw)) return { error: "amount must be a finite number" };
    if (amountRaw <= 0) return { error: "amount must be > 0" };

    const reference = b.reference === undefined ? undefined : String(b.reference);

    const expenseTypeRaw = b.expenseType === undefined ? undefined : String(b.expenseType);
    const expenseType =
        expenseTypeRaw && ["purchase", "bank_deposit", "other"].includes(expenseTypeRaw)
            ? (expenseTypeRaw as CashMovementInput["expenseType"])
            : undefined;

    return { sessionId, type: type as CashMovementInput["type"], amount: amountRaw, reference, expenseType };
}

const uuidPath =
    "([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})";

// ---------- sessions ----------

/**
 * POST /api/cash/sessions/open
 * Roles: cashier, super_admin
 * Body: { registerId, openingFloat }
 */
cashierRouter.post(
    "/api/cash/sessions/open",
    requireRoles(["cashier", "super_admin"]),
    async (ctx) => {
        const auth = ctx.state.auth;
        if (!auth?.user?.id) return unauthorized(ctx, "missing authenticated user");

        let body: unknown;
        try {
            body = await ctx.request.body.json();
        } catch {
            return badRequest(ctx, "Invalid JSON body");
        }

        const parsed = parseOpenSession(body);
        if ("error" in parsed) return badRequest(ctx, parsed.error);

        // verify register exists
        const register = await prisma.cashRegister.findUnique({ where: { id: parsed.registerId } });
        if (!register) return notFound(ctx, "Cash register not found");

        // ensure no open session already for this register
        const existingOpen = await prisma.cashSession.findFirst({
            where: { registerId: parsed.registerId, closedAt: null },
        });
        if (existingOpen) return forbidden(ctx, "Register already has an open session");

        const openReqCtx = await createRequestContext(prisma, auth.user.id, ctx);
        console.log("CashSession fields:", Object.keys(prisma.cashSession.fields));
        // ✅ FIX: use checked create (connect relations) so requestContext.connect is allowed
        const created = await prisma.cashSession.create({
            data: {
                register: { connect: { id: parsed.registerId } },
                openedBy: { connect: { id: auth.user.id } },

                openedAt: new Date(),
                openingFloat: parsed.openingFloat.toFixed(2),

                requestContextId: openReqCtx.id,
            },
        });

        ctx.response.status = 201;
        ctx.response.body = { ok: true, session: created };
    },
);

/**
 * POST /api/cash/sessions/:id/close
 * Roles: cashier, super_admin
 * Body: { declaredTotal }
 */
cashierRouter.post(
    `/api/cash/sessions/:id${uuidPath}/close`,
    requireRoles(["cashier", "super_admin"]),
    async (ctx) => {
        const auth = ctx.state.auth;
        if (!auth?.user?.id) return unauthorized(ctx, "missing authenticated user");

        const sessionId = ctx.params.id!;
        const session = await prisma.cashSession.findUnique({ where: { id: sessionId } });
        if (!session) return notFound(ctx, "Cash session not found");
        if (session.closedAt) return forbidden(ctx, "Cash session already closed");

        let body: unknown;
        try {
            body = await ctx.request.body.json();
        } catch {
            return badRequest(ctx, "Invalid JSON body");
        }
        const parsed = parseCloseSession(body);
        if ("error" in parsed) return badRequest(ctx, parsed.error);

        // Calculate system total = openingFloat + deposits + sales - withdrawals +/- adjustments
        const moves = await prisma.cashMovement.findMany({ where: { sessionId } });

        const sum = (t: string) =>
            moves.filter((m: any) => m.type === (t as any)).reduce((acc: number, m: any) => acc + Number(m.amount), 0);

        const deposits = sum("deposit");
        const sales = sum("sale");
        const withdrawals = sum("withdrawal");
        const adjustments = sum("adjustment");

        const systemTotal = Number(session.openingFloat) + deposits + sales - withdrawals + adjustments;
        const variance = Number(parsed.declaredTotal) - systemTotal;

        const closeReqCtx = await createRequestContext(prisma, auth.user.id, ctx);

        const updated = await prisma.cashSession.update({
            where: { id: sessionId },
            data: {
                // ✅ closedById is NOT accepted in your generated client; use relation connect
                closedBy: { connect: { id: auth.user.id } },
                closedAt: new Date(),
                declaredTotal: parsed.declaredTotal.toFixed(2),
                systemTotal: systemTotal.toFixed(2),
                variance: variance.toFixed(2),

                // ✅ auditing RC for close
                closedRequestContextId: closeReqCtx.id,
            },
        });

        ctx.response.body = {
            ok: true,
            session: updated,
            breakdown: {
                openingFloat: Number(session.openingFloat),
                deposits,
                sales,
                withdrawals,
                adjustments,
            },
        };
    },
);

/**
 * GET /api/cash/sessions?status=open|closed&limit=20&cursor=<sessionId>
 * Roles: cashier, super_admin
 */
cashierRouter.get(
    "/api/cash/sessions",
    requireRoles(["cashier", "super_admin"]),
    async (ctx) => {
        const qp = ctx.request.url.searchParams;
        const status = qp.get("status");
        const limit = Math.min(Number(qp.get("limit") ?? 20), 100);
        const cursor = qp.get("cursor") ?? undefined;

        const where =
            status === "open"
                ? { closedAt: null }
                : status === "closed"
                    ? { NOT: { closedAt: null } }
                    : {};

        const items = await prisma.cashSession.findMany({
            where,
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            orderBy: [{ openedAt: "desc" }, { id: "desc" }],
            include: {
                register: { select: { id: true, name: true } },
                openedBy: { select: { id: true, fullName: true, username: true } },
                closedBy: { select: { id: true, fullName: true, username: true } },
            },
        });

        let nextCursor: string | null = null;
        if (items.length > limit) {
            const last = items.pop()!;
            nextCursor = last.id;
        }

        ctx.response.body = { items, nextCursor, limit };
    },
);

/**
 * GET /api/cash/sessions/:id
 * Roles: cashier, super_admin
 * Returns session with last 50 movements
 */
cashierRouter.get(
    `/api/cash/sessions/:id${uuidPath}`,
    requireRoles(["cashier", "super_admin"]),
    async (ctx) => {
        const id = ctx.params.id!;
        const session = await prisma.cashSession.findUnique({
            where: { id },
            include: {
                register: true,
                openedBy: { select: { id: true, fullName: true, username: true } },
                closedBy: { select: { id: true, fullName: true, username: true } },
            },
        });
        if (!session) return notFound(ctx, "Cash session not found");

        const movements = await prisma.cashMovement.findMany({
            where: { sessionId: id },
            take: 50,
            orderBy: { createdAt: "desc" },
            include: {
                createdBy: { select: { id: true, fullName: true, username: true } },
            },
        });

        ctx.response.body = { session, recentMovements: movements };
    },
);

// ---------- movements ----------

/**
 * POST /api/cash/movements
 * Roles: cashier, super_admin
 */
cashierRouter.post(
    "/api/cash/movements",
    requireRoles(["cashier", "super_admin"]),
    async (ctx) => {
        const auth = ctx.state.auth;
        if (!auth?.user?.id) return unauthorized(ctx, "missing authenticated user");

        let json: unknown;
        try {
            json = await ctx.request.body.json();
        } catch {
            return badRequest(ctx, "Invalid JSON body");
        }

        const parsed = parseCashMovement(json);
        if ("error" in parsed) return badRequest(ctx, parsed.error, parsed.details);

        const { sessionId, type, amount, reference, expenseType } = parsed;

        // validate session exists and open
        const session = await prisma.cashSession.findUnique({ where: { id: sessionId } });
        if (!session) return badRequest(ctx, "Cash session not found", { sessionId });
        if (session.closedAt) return forbidden(ctx, "Cash session is closed");

        const reqCtx = await createRequestContext(prisma, auth.user.id, ctx);

        // ✅ FIX: checked create (connect relations) so requestContext.connect is allowed
        const created = await prisma.cashMovement.create({
            data: {
                session: { connect: { id: sessionId } },
                createdBy: { connect: { id: auth.user.id } },
                requestContext: { connect: { id: reqCtx.id } },

                type,
                amount: amount.toFixed(2),
                reference: reference ?? null,
                expenseType: expenseType ?? null,
            },
        });

        ctx.response.status = 201;
        ctx.response.body = { ok: true, movement: created };
    },
);

/**
 * GET /api/cash/movements?sessionId=&type=&from=&to=&limit=&cursor=
 * Roles: cashier, super_admin
 */
cashierRouter.get(
    "/api/cash/movements",
    requireRoles(["cashier", "super_admin"]),
    async (ctx) => {
        const qp = ctx.request.url.searchParams;
        const limit = Math.min(Number(qp.get("limit") ?? 50), 200);
        const cursor = qp.get("cursor") ?? undefined;

        const sessionId = qp.get("sessionId") ?? undefined;
        const type = qp.get("type") ?? undefined; // sale|deposit|withdrawal|adjustment
        const from = qp.get("from") ? new Date(qp.get("from")!) : undefined;
        const to = qp.get("to") ? new Date(qp.get("to")!) : undefined;

        const where: any = {};
        if (sessionId) where.sessionId = sessionId;
        if (type) where.type = type;
        if (from || to) {
            where.createdAt = {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
            };
        }

        const items = await prisma.cashMovement.findMany({
            where,
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            include: {
                createdBy: { select: { id: true, fullName: true, username: true } },
                session: { select: { id: true, registerId: true, closedAt: true } },
            },
        });

        let nextCursor: string | null = null;
        if (items.length > limit) {
            const last = items.pop()!;
            nextCursor = last.id;
        }

        ctx.response.body = { items, nextCursor, limit };
    },
);

/**
 * DELETE /api/cash/movements/:id
 * Roles: super_admin only
 * Only allowed while session is still open.
 */
cashierRouter.delete(
    `/api/cash/movements/:id${uuidPath}`,
    requireRoles(["super_admin"]),
    async (ctx) => {
        const id = ctx.params.id!;
        const mov = await prisma.cashMovement.findUnique({
            where: { id },
            include: { session: true },
        });
        if (!mov) return notFound(ctx, "Cash movement not found");
        if (mov.session.closedAt) return forbidden(ctx, "Cannot delete from a closed session");

        await prisma.cashMovement.delete({ where: { id } });
        ctx.response.body = { ok: true, deletedId: id };
    },
);

/**
 * GET /api/registers?limit=200
 * Roles: cashier, super_admin
 */
cashierRouter.get(
    "/api/registers",
    requireRoles(["cashier", "super_admin"]),
    async (ctx) => {
        const limit = Math.min(Number(ctx.request.url.searchParams.get("limit") ?? 200), 500);

        const items = await prisma.cashRegister.findMany({
            take: limit,
            orderBy: { name: "asc" },
            include: { location: { select: { id: true, name: true } } },
        });

        ctx.response.body = items.map((r) => ({
            id: r.id,
            name: r.name,
            locationId: r.locationId,
            location: r.location ? { id: r.location.id, name: r.location.name } : null,
        }));
    },
);

/**
 * GET /api/cash/summary?sessionId=...
 * Roles: cashier, super_admin
 */
cashierRouter.get(
    "/api/cash/summary",
    requireRoles(["cashier", "super_admin"]),
    async (ctx) => {
        const sessionId = ctx.request.url.searchParams.get("sessionId");
        if (!sessionId) return badRequest(ctx, "sessionId is required");

        const session = await prisma.cashSession.findUnique({ where: { id: sessionId } });
        if (!session) return notFound(ctx, "Cash session not found");

        const moves = await prisma.cashMovement.findMany({ where: { sessionId } });

        const sum = (t: string) =>
            moves.filter((m: any) => m.type === (t as any)).reduce((acc: number, m: any) => acc + Number(m.amount), 0);

        const deposits = sum("deposit");
        const sales = sum("sale");
        const withdrawals = sum("withdrawal");
        const adjustments = sum("adjustment");

        const systemTotal = Number(session.openingFloat) + deposits + sales - withdrawals + adjustments;

        ctx.response.body = {
            session: { id: session.id, openedAt: session.openedAt, closedAt: session.closedAt },
            openingFloat: Number(session.openingFloat),
            totals: { deposits, sales, withdrawals, adjustments },
            systemTotal,
            declaredTotal: session.declaredTotal != null ? Number(session.declaredTotal) : null,
            variance: session.declaredTotal != null ? Number(session.declaredTotal) - systemTotal : null,
        };
    },
);