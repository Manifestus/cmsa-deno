import type { Middleware } from "@oak/oak";
import type { AuthState } from "../types.ts";
import { verifyAuth0AccessToken, ensureLocalUserFromToken } from "../auth.ts";
import { expandPermsFromRoles } from "../perm.ts";

// You can mark some paths as public if you want to bypass 401 for them:
const PUBLIC_PATHS = new Set<string>([
    "/health",
    "/api/public/example",
]);

export const authMiddleware: Middleware<AuthState> = async (ctx, next) => {
    const path = new URL(ctx.request.url).pathname;
    const maybeToken = ctx.request.headers.get("authorization") ?? undefined;

    const hydrateAuth = async () => {
        const claims = await verifyAuth0AccessToken(maybeToken);
        const user = await ensureLocalUserFromToken(claims);
        const perms = expandPermsFromRoles(claims.roles);
        ctx.state.auth = {
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                username: user.username,
            },
            roles: claims.roles,
            perms,
        };
    };

    // Public: allow through; hydrate if token present
    if (PUBLIC_PATHS.has(path)) {
        if (maybeToken?.startsWith("Bearer ")) {
            try {
                await hydrateAuth();
            } catch (e) {
                console.warn(`[auth] public path token rejected: ${path}`, e);
            }
        }
        return next();
    }

    // Protected by default
    try {
        await hydrateAuth();
        await next();
    } catch (_e) {
        ctx.response.status = 401;
        ctx.response.body = { error: "unauthorized" };
    }
};