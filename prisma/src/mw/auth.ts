// prisma/src/mw/auth.ts
import type { Context } from "@oak/oak";
import type { Middleware } from "@oak/oak";
import {
    createRemoteJWKSet,
    jwtVerify,
    type JWTPayload,
} from "https://deno.land/x/jose@v5.8.0/index.ts";
import { PrismaClient } from "../generated/prisma/client.ts";

const prisma = new PrismaClient();

const ISSUER_RAW = Deno.env.get("AUTH0_ISSUER") ?? "https://cmsa.us.auth0.com/";
const ISSUER = ISSUER_RAW.endsWith("/") ? ISSUER_RAW : `${ISSUER_RAW}/`;
const AUDIENCE_API = Deno.env.get("AUTH0_AUDIENCE") ?? "https://cmsa.api";
const CLAIM_NS = Deno.env.get("AUTH0_CLAIM_NS") ?? "https://cmsa.api";

const JWKS = createRemoteJWKSet(new URL(`${ISSUER}.well-known/jwks.json`));

async function tryVerifyBearer(authorization?: string) {
    if (!authorization?.startsWith("Bearer ")) return null;
    const token = authorization.slice("Bearer ".length);

    try {
        const { payload } = await jwtVerify(token, JWKS, {
            issuer: ISSUER,
            audience: [AUDIENCE_API, `${ISSUER}userinfo`],
            clockTolerance: 5,
        });
        return payload as JWTPayload & Record<string, unknown>;
    } catch {
        return null;
    }
}

function safeLocalPart(input: string) {
    const cleaned = input.replace(/[^a-zA-Z0-9._-]/g, "_");
    return cleaned.length > 50 ? cleaned.slice(0, 50) : cleaned;
}

async function ensureLocalUserFromClaims(args: {
    sub: string;
    email?: string;
    fullName?: string;
    username?: string;
}) {
    const sub = args.sub;
    const email = args.email?.trim() || undefined;

    const candidateUsername = (args.username?.trim() || sub).slice(0, 80);
    const candidateFullName = (args.fullName?.trim() || candidateUsername).slice(0, 120);

    const placeholderEmail = `${safeLocalPart(sub)}@placeholder.local`;
    const finalEmail = (email || placeholderEmail).slice(0, 160);

    // Prefer email match if available (most stable)
    let user = await prisma.user.findFirst({
        where: email ? { email } : { username: candidateUsername },
    });

    if (!user) {
        user = await prisma.user.create({
            data: {
                username: candidateUsername,
                fullName: candidateFullName,
                email: finalEmail,
                isActive: true,
            },
        });
        return user;
    }

    // Optional sync (safe)
    const updates: Record<string, unknown> = {};
    if (candidateFullName && user.fullName !== candidateFullName) updates.fullName = candidateFullName;
    if (email && user.email !== email) updates.email = email;
    if (candidateUsername && user.username !== candidateUsername) updates.username = candidateUsername;

    if (Object.keys(updates).length) {
        user = await prisma.user.update({ where: { id: user.id }, data: updates });
    }

    return user;
}

export const authMiddleware: Middleware = async (ctx: Context, next) => {
    ctx.state.auth = undefined;

    const authorization = ctx.request.headers.get("authorization") ?? undefined;
    const payload = await tryVerifyBearer(authorization);

    if (payload) {
        const roles = Array.isArray(payload[`${CLAIM_NS}/roles`])
            ? (payload[`${CLAIM_NS}/roles`] as string[])
            : [];

        const email =
            (payload[`${CLAIM_NS}/email`] as string) ||
            (payload.email as string) ||
            undefined;

        const fullName =
            (payload[`${CLAIM_NS}/name`] as string) ||
            (payload.name as string) ||
            undefined;

        const username =
            (payload[`${CLAIM_NS}/username`] as string) ||
            (payload.nickname as string) ||
            (email ? email.split("@")[0] : undefined) ||
            (payload.sub as string | undefined);

        const sub = String(payload.sub ?? "");
        const dbUser = await ensureLocalUserFromClaims({ sub, email, fullName, username });

        ctx.state.auth = {
            user: {
                id: dbUser.id, // ✅ UUID (fixes RequestContext/AuthSession)
                email: dbUser.email,
                fullName: dbUser.fullName,
                username: dbUser.username,
            },
            roles,
        };
    }

    await next();
};