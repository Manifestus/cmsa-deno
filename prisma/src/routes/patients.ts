// prisma/src/routes/patients.ts
import { Router } from "@oak/oak";
import { PrismaClient } from "../generated/prisma/index.js";
import type { AuthState } from "../types.ts";
import { requireRoles } from "../mw/roleGuard.ts";

const prisma = new PrismaClient();
export const patientsRouter = new Router<AuthState>();

// Helpers
function badRequest(ctx: any, message: string, details?: unknown) {
    ctx.response.status = 400;
    ctx.response.body = { error: "bad_request", message, details };
}
function notFound(ctx: any, message = "not found") {
    ctx.response.status = 404;
    ctx.response.body = { error: "not_found", message };
}
function unauthorized(ctx: any, message = "unauthorized") {
    ctx.response.status = 401;
    ctx.response.body = { error: "unauthorized", message };
}
async function createRequestContext(prisma: PrismaClient, userId: string, ctx: any) {
    const ipAddress = ctx.request.headers.get("x-forwarded-for") ?? ctx.request.ip ?? "127.0.0.1";
    const userAgent = ctx.request.headers.get("user-agent") ?? "unknown";
    return prisma.requestContext.create({
        data: {
            session: { create: { userId, ipAddress, userAgent } },
            ipAddress, userAgent,
        },
    });
}

// Validation (minimal)
type PatientInput = {
    mrn: string;
    firstName: string;
    lastName: string;
    dob?: string;
    sex?: "M" | "F" | "Other" | "Unknown";
    phone?: string;
    email?: string;
    address?: string;
    city?: string; region?: string; country?: string;
};
function parsePatient(body: unknown): PatientInput | { error: string } {
    if (!body || typeof body !== "object") return { error: "Body must be an object" };
    const b = body as Record<string, unknown>;
    const mrn = String(b.mrn ?? "").trim();
    const firstName = String(b.firstName ?? "").trim();
    const lastName = String(b.lastName ?? "").trim();
    if (!mrn || !firstName || !lastName) return { error: "mrn, firstName, lastName are required" };
    const out: PatientInput = { mrn, firstName, lastName };
    if (b.dob) out.dob = String(b.dob);
    if (b.sex) out.sex = b.sex as any;
    for (const k of ["phone", "email", "address", "city", "region", "country"] as const) {
        if (b[k] != null) (out as any)[k] = String(b[k] ?? "");
    }
    return out;
}

// -------- Routes --------

// Search/list (frontdesk, cashier, admin, super_admin)
patientsRouter.get(
    "/api/patients",
    requireRoles(["frontdesk", "cashier", "admin", "super_admin"]),
    async (ctx) => {
        const q = ctx.request.url.searchParams.get("query")?.trim() ?? "";
        const limit = Math.min(50, Math.max(1, Number(ctx.request.url.searchParams.get("limit") ?? 20)));
        const cursor = ctx.request.url.searchParams.get("cursor") ?? undefined;

        const where = q
            ? {
                OR: [
                    { mrn: { contains: q, mode: "insensitive" } },
                    { firstName: { contains: q, mode: "insensitive" } },
                    { lastName: { contains: q, mode: "insensitive" } },
                    { phone: { contains: q, mode: "insensitive" } },
                    { email: { contains: q, mode: "insensitive" } },
                ],
            }
            : {};

        const page = await prisma.patient.findMany({
            where,
            take: limit + 1,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
            orderBy: { createdAt: "desc" },
            select: { id: true, mrn: true, firstName: true, lastName: true, phone: true, email: true, createdAt: true },
        });

        const nextCursor = page.length > limit ? page[limit].id : null;
        ctx.response.body = { items: page.slice(0, limit), nextCursor };
    },
);

// Get by id (same roles)
patientsRouter.get(
    "/api/patients/:id",
    requireRoles(["frontdesk", "cashier", "admin", "super_admin"]),
    async (ctx) => {
        const id = ctx.params.id!;
        const p = await prisma.patient.findUnique({ where: { id } });
        if (!p) return notFound(ctx, "patient not found");
        ctx.response.body = p;
    },
);

// Create (frontdesk, cashier, admin, super_admin)
patientsRouter.post(
    "/api/patients",
    requireRoles(["frontdesk", "cashier", "admin", "super_admin"]),
    async (ctx) => {
        const auth = ctx.state.auth;
        if (!auth?.user?.id) return unauthorized(ctx);
        let body: unknown;
        try { body = await ctx.request.body.json(); } catch { return badRequest(ctx, "Invalid JSON"); }
        const parsed = parsePatient(body);
        if ("error" in parsed) return badRequest(ctx, parsed.error);

        try {
            const rc = await createRequestContext(prisma, auth.user.id, ctx);
            const created = await prisma.patient.create({
                data: {
                    mrn: parsed.mrn,
                    firstName: parsed.firstName,
                    lastName: parsed.lastName,
                    dob: parsed.dob ? new Date(parsed.dob) : null,
                    sex: parsed.sex ?? null,
                    phone: parsed.phone ?? null,
                    email: parsed.email ?? null,
                    address: parsed.address ?? null,
                    city: parsed.city ?? null,
                    region: parsed.region ?? null,
                    country: parsed.country ?? null,
                    createdById: auth.user.id,
                },
            });
            await prisma.activityLog.create({
                data: {
                    entity: "Patient",
                    entityId: created.id,
                    action: "create",
                    actorId: auth.user.id,
                    requestContextId: rc.id,
                },
            });
            ctx.response.status = 201;
            ctx.response.body = created;
        } catch (e) {
            if ((e as any)?.code === "P2002") return badRequest(ctx, "MRN already exists");
            throw e;
        }
    },
);

// Update (admin, super_admin, doctor could be added later)
patientsRouter.patch(
    "/api/patients/:id",
    requireRoles(["admin", "super_admin"]),
    async (ctx) => {
        const auth = ctx.state.auth;
        if (!auth?.user?.id) return unauthorized(ctx);
        const id = ctx.params.id!;
        const exists = await prisma.patient.findUnique({ where: { id } });
        if (!exists) return notFound(ctx, "patient not found");
        let body: Record<string, unknown>;
        try { body = await ctx.request.body.json(); } catch { return badRequest(ctx, "Invalid JSON"); }

        const data: any = {};
        for (const k of [
            "firstName","lastName","phone","email","address","city","region","country","mrn",
        ] as const) if (k in body) data[k] = body[k] ?? null;
        if ("dob" in body) data.dob = body.dob ? new Date(String(body.dob)) : null;
        if ("sex" in body) data.sex = body.sex ?? null;

        const rc = await createRequestContext(prisma, auth.user.id, ctx);
        const updated = await prisma.patient.update({ where: { id }, data });
        await prisma.activityLog.create({
            data: { entity: "Patient", entityId: id, action: "update", actorId: auth.user.id, requestContextId: rc.id },
        });
        ctx.response.body = updated;
    },
);

// (Optional) Delete — strongly restricted
patientsRouter.delete(
    "/api/patients/:id",
    requireRoles(["super_admin"]),
    async (ctx) => {
        const auth = ctx.state.auth;
        if (!auth?.user?.id) return unauthorized(ctx);
        const id = ctx.params.id!;
        const p = await prisma.patient.findUnique({ where: { id } });
        if (!p) return notFound(ctx);
        const rc = await createRequestContext(prisma, auth.user.id, ctx);
        await prisma.patient.delete({ where: { id } });
        await prisma.activityLog.create({
            data: { entity: "Patient", entityId: id, action: "delete", actorId: auth.user.id, requestContextId: rc.id },
        });
        ctx.response.status = 204;
    },
);