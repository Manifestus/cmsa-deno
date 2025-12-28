// src/auth/verifyAuth0.ts
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "https://deno.land/x/jose@v5.8.0/index.ts";

const ISSUER_RAW = Deno.env.get("AUTH0_ISSUER") ?? "https://cmsa.us.auth0.com/";
const ISSUER = ISSUER_RAW.endsWith("/") ? ISSUER_RAW : `${ISSUER_RAW}/`;
const AUDIENCE_API = Deno.env.get("AUTH0_AUDIENCE") ?? "https://cmsa.api";

// Auth0 JWKS endpoint
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}.well-known/jwks.json`));

export async function verifyAuth0Bearer(authorization?: string): Promise<{ payload: JWTPayload; token: string }> {
    if (!authorization?.startsWith("Bearer ")) {
        throw new Error("no_bearer");
    }
    const token = authorization.slice("Bearer ".length);

    const { payload } = await jwtVerify(token, JWKS, {
        issuer: ISSUER,
        // 👇 Accept BOTH audiences your token actually has:
        //  - your API audience (https://cmsa.api)
        //  - Auth0 userinfo audience (https://<tenant>/userinfo)
        audience: [AUDIENCE_API, `${ISSUER}userinfo`],
        // small clock skew tolerance (safe, avoids edge 401s)
        clockTolerance: 5,
    });

    return { payload, token };
}