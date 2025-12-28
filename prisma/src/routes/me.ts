import type { RouterContext } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import type { AuthedState } from "../middleware/auth.ts";
import { PrismaClient } from "../generated/prisma/client.ts";

const prisma = new PrismaClient();

export async function getMe(
    ctx: RouterContext<"/api/me", Record<string, string | undefined>, AuthedState>,
) {
    const s = ctx.state as AuthedState;

    const user = await (prisma as any).user.findUnique({ where: { id: s.userId } });

    ctx.response.status = 200;
    ctx.response.body = {
        user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            username: user.username,
        },
        roles: s.roles.length ? s.roles : s.rolesFromToken,
    };
}