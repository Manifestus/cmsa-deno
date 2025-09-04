import type { Middleware } from "@oak/oak";
import {AuthState} from "./types.ts";


/** Deny by default, allow if ANY requested permission is present */
export function requirePerms(perms: string | string[]): Middleware<AuthState> {
    const need = Array.isArray(perms) ? perms : [perms];
    return async (ctx, next) => {
        const granted = new Set((ctx.state.auth?.perms ?? []).map((p: any) => p.toLowerCase()));
        const ok = need.some((p) => granted.has(p.toLowerCase()));
        if (!ok) {
            ctx.response.status = 403;
            ctx.response.body = {
                error: "forbidden",
                message: "You do not have the required permissions for this operation.",
                need,
                have: [...granted],
            };
            return;
        }
        await next();
    };
}