import { Router } from "@oak/oak";
import { PrismaClient } from "../generated/prisma/index.js";
import type { AuthState } from "../types.ts";
import { requireRoles } from "../mw/roleGuard.ts";

const prisma = new PrismaClient();
export const preclinicRouter = new Router<AuthState>();

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

// Create Preclinic (frontdesk, doctor, admin, super_admin)
preclinicRouter.post(
    "/api/preclinics",
    requireRoles(["frontdesk", "doctor", "admin", "super_admin"]),
    async (ctx) => {
        const auth = ctx.state.auth;
        if (!auth?.user?.id) return unauthorized(ctx);
        let body: any;
        try { body = await ctx.request.body.json(); } catch { return badRequest(ctx, "Invalid JSON"); }

        const { patientId, visitDate, bloodPressureSystolic, bloodPressureDiastolic, heartRate, respRate,
            temperatureC, weightKg, heightCm, bmi, chiefComplaint, currentMedications,
            diabetes, hypertension, otherConditions, allergiesReported } = body ?? {};

        if (!patientId) return badRequest(ctx, "patientId is required");
        const patient = await prisma.patient.findUnique({ where: { id: String(patientId) } });
        if (!patient) return notFound(ctx, "patient not found");

        const rc = await createRequestContext(prisma, auth.user.id, ctx);

        const created = await prisma.preclinic.create({
            data: {
                patientId,
                visitDate: visitDate ? new Date(visitDate) : new Date(),
                bloodPressureSystolic: bloodPressureSystolic ?? null,
                bloodPressureDiastolic: bloodPressureDiastolic ?? null,
                heartRate: heartRate ?? null,
                respRate: respRate ?? null,
                temperatureC: temperatureC != null ? String(temperatureC) : null,
                weightKg: weightKg != null ? String(weightKg) : null,
                heightCm: heightCm != null ? String(heightCm) : null,
                bmi: bmi != null ? String(bmi) : null,
                chiefComplaint: chiefComplaint ?? null,
                currentMedications: currentMedications ?? null,
                diabetes: diabetes ?? null,
                hypertension: hypertension ?? null,
                otherConditions: otherConditions ?? null,
                allergiesReported: allergiesReported ?? null,
                recordedById: auth.user.id,
                requestContextId: rc.id,
            },
        });

        ctx.response.status = 201;
        ctx.response.body = created;
    },
);

// Get a preclinic
preclinicRouter.get(
    "/api/preclinics/:id",
    requireRoles(["frontdesk", "doctor", "admin", "super_admin"]),
    async (ctx) => {
        const id = ctx.params.id!;
        const item = await prisma.preclinic.findUnique({ where: { id } });
        if (!item) return notFound(ctx, "preclinic not found");
        ctx.response.body = item;
    },
);

// List preclinics for a patient
preclinicRouter.get(
    "/api/patients/:id/preclinics",
    requireRoles(["frontdesk", "doctor", "admin", "super_admin"]),
    async (ctx) => {
        const id = ctx.params.id!;
        const limit = Math.min(50, Math.max(1, Number(ctx.request.url.searchParams.get("limit") ?? 20)));
        const cursor = ctx.request.url.searchParams.get("cursor") ?? undefined;
        const page = await prisma.preclinic.findMany({
            where: { patientId: id },
            take: limit + 1,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
            orderBy: { visitDate: "desc" },
        });
        const nextCursor = page.length > limit ? page[limit].id : null;
        ctx.response.body = { items: page.slice(0, limit), nextCursor };
    },
);

// Update a preclinic (doctor, admin, super_admin)
preclinicRouter.patch(
    "/api/preclinics/:id",
    requireRoles(["doctor", "admin", "super_admin"]),
    async (ctx) => {
        const auth = ctx.state.auth;
        if (!auth?.user?.id) return unauthorized(ctx);
        const id = ctx.params.id!;
        const exists = await prisma.preclinic.findUnique({ where: { id } });
        if (!exists) return notFound(ctx, "preclinic not found");
        const body = await ctx.request.body.json().catch(() => ({} as any));
        const rc = await createRequestContext(prisma, auth.user.id, ctx);
        const updated = await prisma.preclinic.update({ where: { id }, data: body });
        await prisma.activityLog.create({
            data: { entity: "Preclinic", entityId: id, action: "update", actorId: auth.user.id, requestContextId: rc.id },
        });
        ctx.response.body = updated;
    },
);

preclinicRouter.get(
    "/api/preclinics",
    requireRoles(["frontdesk", "doctor", "admin", "super_admin"]),
    async (ctx) => {
        const q = ctx.request.url.searchParams;
        const limit = Math.min(50, Math.max(1, Number(q.get("limit") ?? 20)));
        const cursor = q.get("cursor") ?? undefined;
        const patientId = q.get("patientId") ?? undefined;

        const where = patientId ? { patientId } : {};

        const page = await prisma.preclinic.findMany({
            where,
            take: limit + 1,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
            orderBy: { visitDate: "desc" },
        });

        const nextCursor = page.length > limit ? page[limit].id : null;
        ctx.response.body = { items: page.slice(0, limit), nextCursor };
    },
);

// --- Compatibility alias: /api/preclinic -> /api/preclinics ---
preclinicRouter.get("/api/preclinic", async (ctx) => {
    const search = ctx.request.url.search ?? "";
    ctx.response.status = 308; // Permanent Redirect
    ctx.response.headers.set("Location", `/api/preclinics${search}`);
});