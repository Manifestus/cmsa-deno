// prisma/src/routes/cash.ts
import { Router } from "@oak/oak";
import { PrismaClient } from "../prisma/src/generated/prisma/client.ts";
import {AuthState} from "../prisma/src/types.ts";
import {requireRoles} from "../prisma/src/mw/roleGuard.ts";

// Reuse a single Prisma client here (or inject it if you prefer)
const prisma = new PrismaClient();

const cashierRouter = new Router<AuthState>();

// --------- helpers ---------

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

// Create a RequestContext and (nested) AuthSession for this HTTP request
async function createRequestContext(prisma: PrismaClient, userId: string, ctx: any) {
    const ipAddress = ctx.request.ip ??
        ctx.request.headers.get("x-forwarded-for") ??
        "127.0.0.1";
    const userAgent = ctx.request.headers.get("user-agent") ?? "unknown";

    const rc = await prisma.requestContext.create({
        data: {
            session: {
                create: {
                    userId,
                    ipAddress,
                    userAgent,
                    // workstationId (optional) could be set by another middleware if you use it
                    // mfaPassed: true/false (default false)
                },
            },
            ipAddress,
            userAgent,
            // geo* can be filled later by a geo-IP middleware if you want
        },
    });

    return rc;
}

// Simple runtime validation (no extra deps)
type CashMovementInput = {
    sessionId: string;
    type: "sale" | "withdrawal" | "deposit" | "adjustment";
    amount: number;
    reference?: string;
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
    if (typeof amountRaw !== "number" || !isFinite(amountRaw)) {
        return { error: "amount must be a finite number" };
    }
    if (amountRaw <= 0) {
        return { error: "amount must be > 0" };
    }

    const reference = b.reference === undefined ? undefined : String(b.reference);
    return { sessionId, type: type as CashMovementInput["type"], amount: amountRaw, reference };
}

// --------- routes ---------

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
        if ("error" in parsed) {
            return badRequest(ctx, parsed.error, parsed.details);
        }

        const { sessionId, type, amount, reference } = parsed;

        // 1) Validate the cash session exists and is open
        const session = await prisma.cashSession.findUnique({
            where: { id: sessionId },
            include: { register: true },
        });

        if (!session) {
            return badRequest(ctx, "Cash session not found", { sessionId });
        }
        if (session.closedAt) {
            return forbidden(ctx, "Cash session is closed");
        }

        // 2) Create request context (and nested auth session)
        const reqCtx = await createRequestContext(prisma, auth.user.id, ctx);

        // 3) Create the movement
        try {
            const created = await prisma.cashMovement.create({
                data: {
                    sessionId: session.id,
                    type,                                      // enum
                    amount: amount.toFixed(2),                 // Decimal expects string or Decimal
                    reference: reference ?? null,
                    createdById: auth.user.id,
                    requestContextId: reqCtx.id,
                },
            });

            ctx.response.status = 201;
            ctx.response.body = {
                ok: true,
                movement: created,
                // a tiny bit of helpful context in the response:
                register: { id: session.registerId, name: session.register?.name },
                session: { id: session.id, openedAt: session.openedAt, closedAt: session.closedAt },
            };
        } catch (e) {
            console.error("cash movement create failed:", e);
            ctx.response.status = 500;
            ctx.response.body = {
                error: "server_error",
                message: "Failed to create cash movement",
            };
        }
    },
);

export { cashierRouter };