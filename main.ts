// main.ts
import { Application, Router } from "@oak/oak";
import type { AuthState } from "./prisma/src/types.ts";
import { authMiddleware } from "./prisma/src/mw/auth.ts";
import { requireRoles } from "./prisma/src/mw/roleGuard.ts";

// EXISTING routers you already had:
import { cashierRouter } from "./prisma/src/routes/cashier.ts";

// NEW routers:
import { patientsRouter } from "./prisma/src/routes/patients.ts";
import { preclinicRouter } from "./prisma/src/routes/preclinic.ts";
import { invoicesRouter } from "./prisma/src/routes/invoices.ts";

const app = new Application<AuthState>();
const router = new Router<AuthState>();

app.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    console.log(`${ctx.request.method} ${ctx.request.url.pathname}${ctx.request.url.search} ${ctx.response.status} in ${ms}ms`);
});

// Public
router.get("/health", (ctx) => (ctx.response.body = { ok: true }));

// Semi-public (will include auth if token present)
router.get("/api/public/example", (ctx) => {
  ctx.response.body = { message: "Hello from a public route", auth: ctx.state.auth ?? null };
});

// Authenticated (sample)
router.get("/api/me", (ctx) => {
  if (!ctx.state.auth) {
    ctx.response.status = 401;
    ctx.response.body = { error: "unauthorized" };
    return;
  }
  ctx.response.body = ctx.state.auth;
});

// Admin-only (sample)
router.get("/api/admin/roles", requireRoles(["admin", "super_admin"]), (ctx) => {
  ctx.response.body = { ok: true, where: "admin area" };
});

// Mount middleware and routers (order matters)
app.use(authMiddleware);

// core router
app.use(router.routes());
app.use(router.allowedMethods());

// feature routers
app.use(cashierRouter.routes());
app.use(cashierRouter.allowedMethods());

app.use(patientsRouter.routes());
app.use(patientsRouter.allowedMethods());

app.use(preclinicRouter.routes());
app.use(preclinicRouter.allowedMethods());

app.use(invoicesRouter.routes());
app.use(invoicesRouter.allowedMethods());

console.log("HTTP listening on http://localhost:8000");
await app.listen({ port: 8000 });