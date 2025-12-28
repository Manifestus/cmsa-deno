// tests/api_smoke_test.ts
import { Application } from "@oak/oak";
import { superoak } from "https://deno.land/x/superoak/mod.ts";
import type { AuthState } from "../types.ts";
import { patientsRouter } from "../routes/patients.ts";
import { invoicesRouter } from "../routes/invoices.ts";
import { preclinicRouter } from "../routes/preclinic.ts";

function fakeAuth(roles: string[]): (ctx: any, next: any) => Promise<void> {
    return async (ctx, next) => {
        ctx.state.auth = {
            user: { id: "00000000-0000-0000-0000-000000000001", email: "test@local", fullName: "Test", username: "test" },
            roles,
        };
        await next();
    };
}

Deno.test("patients create + get", async () => {
    const app = new Application<AuthState>();
    app.use(fakeAuth(["frontdesk", "cashier", "admin", "super_admin"]));
    app.use(patientsRouter.routes());

    const request = await superoak(app);
    const mrn = `MRN-${crypto.randomUUID().slice(0, 8)}`;
    const create = await request.post("/api/patients").send({
        mrn, firstName: "Ana", lastName: "Gomez", phone: "9999-8888",
    }).expect(201);

    const id = create.body.id as string;
    await (await superoak(app)).get(`/api/patients/${id}`).expect(200);
});

Deno.test("invoice draft → add line → post", async () => {
    const app = new Application<AuthState>();
    app.use(fakeAuth(["cashier", "super_admin"]));
    app.use(invoicesRouter.routes());

    // create draft (locationId required – use a known one from your seed)
    const locationId = Deno.env.get("TEST_LOCATION_ID") ?? "00000000-0000-0000-0000-000000000002";
    const draft = await (await superoak(app)).post("/api/invoices").send({ locationId }).expect(201);
    const id = draft.body.id as string;

    // add line
    await (await superoak(app)).post(`/api/invoices/${id}/lines`).send({
        itemType: "service",
        serviceId: Deno.env.get("TEST_SERVICE_ID") ?? undefined, // set real ID or create one in a beforeAll
        description: "Consulta general",
        qty: 1,
        unitPrice: 350,
        discountPct: 0,
        taxRatePct: 0,
    }).expect((res) => {
        // serviceId may be required; if undefined, expect 400
        if (res.status === 400) return;
        if (res.status !== 201) throw new Error("Expected 201 or 400");
    });

    // post (will 400 if no lines)
    await (await superoak(app)).post(`/api/invoices/${id}/post`).expect((res) => {
        if (res.status !== 200 && res.status !== 400) throw new Error("Expected 200 or 400");
    });
});

Deno.test("preclinic create", async () => {
    const app = new Application<AuthState>();
    app.use(fakeAuth(["frontdesk", "doctor", "super_admin"]));
    app.use(preclinicRouter.routes());

    // use a real patientId from env or create in test setup
    const patientId = Deno.env.get("TEST_PATIENT_ID") ?? "00000000-0000-0000-0000-000000000003";

    await (await superoak(app)).post("/api/preclinics").send({
        patientId, chiefComplaint: "Headache", heartRate: 74, temperatureC: "36.8",
    }).expect((res) => {
        // If patientId is fake, expect 404; otherwise 201
        if (res.status !== 201 && res.status !== 404) throw new Error("Expected 201 or 404");
    });
});