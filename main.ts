import { Application, Router } from "@oak/oak";
import type { AuthState } from "./prisma/src/types.ts";
import { authMiddleware } from "./prisma/src/mw/auth.ts";
import { requireRoles } from "./prisma/src/mw/roleGuard.ts";
import { errorHandler } from "./prisma/src/mw/errorHandler.ts";
import { cashierRouter } from "./routes/cashier.ts";

const app = new Application<AuthState>();
const router = new Router<AuthState>();

// Public
router.get("/health", (ctx) => {
  ctx.response.body = { ok: true };
});

// Semi-public
router.get("/api/public/example", (ctx) => {
  ctx.response.body = {
    message: "Hello from a public route",
    auth: ctx.state.auth ?? null,
  };
});

// Authenticated
router.get("/api/me", (ctx) => {
  if (!ctx.state.auth) {
    ctx.response.status = 401;
    ctx.response.body = { error: "unauthorized" };
    return;
  }
  ctx.response.body = ctx.state.auth;
});

// Admin-only sample (kept)
router.get("/api/admin/roles", requireRoles(["admin", "super_admin"]), (ctx) => {
  ctx.response.body = { ok: true, where: "admin area" };
});

app.use(errorHandler);
app.use(authMiddleware);
app.use(router.routes());
app.use(router.allowedMethods());

// Cashier API (permissions-based)
app.use(cashierRouter.routes());
app.use(cashierRouter.allowedMethods());

console.log("HTTP listening on http://localhost:8000");
await app.listen({ port: 8000 });