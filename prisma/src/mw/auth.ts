// prisma/src/mw/auth.ts
import type { Context } from "@oak/oak";
import type { Middleware } from "@oak/oak";
import {
    createRemoteJWKSet,
    jwtVerify,
    type JWTPayload,
} from "https://deno.land/x/jose@v5.8.0/index.ts";

/**
 * We set ctx.state.auth if token is valid:
 *   ctx.state.auth = {
 *     user: { id, email?, fullName?, username? },
 *     roles: string[],
 *     // raw?: payload
 *   }
 */

// ---- Env & constants --------------------------------------------------------
const ISSUER_RAW = Deno.env.get("AUTH0_ISSUER") ?? "https://cmsa.us.auth0.com/";
const ISSUER = ISSUER_RAW.endsWith("/") ? ISSUER_RAW : `${ISSUER_RAW}/`;
const AUDIENCE_API = Deno.env.get("AUTH0_AUDIENCE") ?? "https://cmsa.api";
const CLAIM_NS = Deno.env.get("AUTH0_CLAIM_NS") ?? "https://cmsa.api";

const JWKS = createRemoteJWKSet(new URL(`${ISSUER}.well-known/jwks.json`));

// ---- Helper: safe verify that never throws ----------------------------------
async function tryVerifyBearer(
    authorization?: string,
): Promise<(JWTPayload & Record<string, unknown>) | null> {
    if (!authorization?.startsWith("Bearer ")) return null;
    const token = authorization.slice("Bearer ".length);
    try {
        const { payload } = await jwtVerify(token, JWKS, {
            issuer: ISSUER,
            // Accept BOTH audiences that Auth0 may place in the AT:
            // - your API audience (https://cmsa.api)
            // - the Auth0 userinfo audience (<issuer>/userinfo)
            audience: [AUDIENCE_API, `${ISSUER}userinfo`],
            clockTolerance: 5,
        });
        return payload as JWTPayload & Record<string, unknown>;
    } catch {
        return null; // treat invalid/expired as unauthenticated
    }
}

// ---- Middleware -------------------------------------------------------------
export const authMiddleware: Middleware = async (ctx: Context, next) => {
    ctx.state.auth = undefined; // default

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

        ctx.state.auth = {
            user: {
                id: String(payload.sub ?? ""),
                email,
                fullName,
                username,
            },
            roles,
            // raw: payload, // uncomment for debugging
        };
    }

    // IMPORTANT: call next() exactly once
    await next();
};