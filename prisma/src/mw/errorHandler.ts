// prisma/src/mw/errorHandler.ts
import type { Middleware } from "@oak/oak";

export const errorHandler: Middleware = async (ctx, next) => {
    const rid = crypto.randomUUID();
    try {
        await next();
    } catch (err: unknown) {
        console.error(`[${rid}]`, err);

        // narrow the error
        const e = err as { status?: number; message?: string };

        const status = typeof e?.status === "number" ? e.status : 500;
        ctx.response.status = status;
        ctx.response.body = {
            error: status === 500 ? "internal_error" : "request_error",
            message: e?.message ?? "Unexpected error",
            requestId: rid,
            hint:
                status === 500
                    ? "Contact support with the requestId."
                    : "Review your input and try again.",
        };
    }
};