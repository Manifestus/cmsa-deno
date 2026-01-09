import { PrismaClient } from "./generated/prisma/client.ts";
import * as jose from "jose";
import "jsr:@std/dotenv/load";

const ISSUER   = Deno.env.get("AUTH0_ISSUER")!;
const AUDIENCE = Deno.env.get("AUTH0_AUDIENCE")!;
const NS       = Deno.env.get("AUTH0_NAMESPACE") ?? "https://cmsa.api";

/** Ensure ISSUER ends with a single slash for .well-known building */
function withTrailingSlash(v: string) {
    return v.endsWith("/") ? v : `${v}/`;
}
const JWKS_URL = `${withTrailingSlash(ISSUER)}.well-known/jwks.json`;

const prisma = new PrismaClient();

// --- JWKS key loader ---
const jwks = jose.createRemoteJWKSet(new URL(JWKS_URL));

export type TokenClaims = {
    sub: string;
    email: string;
    name: string;
    username: string;
    roles: string[];
};

export async function verifyAuth0AccessToken(authorization?: string): Promise<TokenClaims> {
    if (!authorization?.startsWith("Bearer ")) throw new Error("Missing Bearer token");
    const token = authorization.slice("Bearer ".length).trim();

    const { payload } = await jose.jwtVerify(token, jwks, {
        issuer: ISSUER,
        audience: AUDIENCE,
    });

    // Roles from namespaced claim; fall back to empty array
    const roles =
        (payload[`${NS}/roles`] as string[] | undefined) ??
        ([] as string[]);

    // Email: prefer namespaced, then standard OIDC email
    const email =
        (payload[`${NS}/email`] as string | undefined) ??
        (payload.email as string | undefined) ??
        "";

    // Name: prefer OIDC name, else from email local-part
    const name =
        (payload.name as string | undefined) ??
        (email ? email.split("@")[0] : "") ??
        "";

    // Username: prefer namespaced, else nickname/preferred_username, else from email/user_id
    const username =
        (payload[`${NS}/username`] as string | undefined) ??
        (payload.nickname as string | undefined) ??
        (payload["preferred_username"] as string | undefined) ??
        (email ? email.split("@")[0] : undefined) ??
        (payload.sub as string);

    return {
        sub: payload.sub as string,
        email,
        name,
        username,
        roles: Array.isArray(roles) ? roles : [],
    };
}

export async function ensureLocalUserFromToken(claims: TokenClaims) {
    // 1) user by email
    let user = await prisma.user.findUnique({ where: { email: claims.email } }).catch(() => null as any);
    if (!user) {
        user = await prisma.user.create({
            data: {
                username: claims.username?.toLowerCase() || claims.email || claims.sub,
                fullName: claims.name || claims.username || claims.email || claims.sub,
                email: claims.email || `${claims.sub}@no-email.local`,
                isActive: true,
            },
        });
    }

    // 2) Ensure roles exist (dev convenience)
    const wantedRoleNames = (claims.roles ?? []).map((r) => r.toLowerCase());
    if (wantedRoleNames.length) {
        const existingRoles = await prisma.role.findMany({ where: { name: { in: wantedRoleNames } } });
        const existingBy = new Map(existingRoles.map((r) => [r.name, r]));
        for (const rn of wantedRoleNames) {
            if (!existingBy.has(rn)) {
                const created = await prisma.role.create({ data: { name: rn } });
                existingBy.set(rn, created);
            }
        }

        // 3) Sync userRole join table
        const links = await prisma.userRole.findMany({ where: { userId: user.id } });
        const linkedRoleIds = new Set(links.map((l) => l.roleId));
        const desiredRoleIds = new Set(wantedRoleNames.map((rn) => existingBy.get(rn)!.id));

        // add missing
        for (const roleId of desiredRoleIds) {
            if (!linkedRoleIds.has(roleId)) {
                await prisma.userRole.create({ data: { userId: user.id, roleId } });
            }
        }
        // remove extras (comment out if you prefer additive-only)
        for (const link of links) {
            if (!desiredRoleIds.has(link.roleId)) {
                await prisma.userRole.delete({
                    where: { userId_roleId: { userId: user.id, roleId: link.roleId } },
                });
            }
        }
    }

    return user;
}

/** Simple role check */
export function requireRole(userRoles: string[], needed: string | string[]) {
    const req = Array.isArray(needed) ? needed : [needed];
    const you = new Set(userRoles.map((r) => r.toLowerCase()));
    return req.some((r) => you.has(r.toLowerCase()));
}