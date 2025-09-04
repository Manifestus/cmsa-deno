import type { Middleware } from "@oak/oak";
import type { AuthState } from "../types.ts";

export function requireRoles(required: string | string[]): Middleware<AuthState> {
    const need = Array.isArray(required) ? required.map((r) => r.toLowerCase()) : [required.toLowerCase()];
    return async (ctx, next) => {
        const roles = (ctx.state.auth?.roles ?? []).map((r) => r.toLowerCase());
        const ok = need.some((r) => roles.includes(r));
        if (!ok) {
            ctx.response.status = 403;
            ctx.response.body = { error: "forbidden", need };
            return;
        }
        await next();
    };
}