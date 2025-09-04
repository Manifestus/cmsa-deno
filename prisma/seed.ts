// prisma/seed.ts
// Run with:
// deno run --allow-net --allow-env --allow-read --allow-ffi --env-file=.env prisma/seed.ts
// or: deno task seed
import { PrismaClient } from "./src/generated/prisma/client.ts";

const prisma = new PrismaClient();

// Natural-key "upsert" using findFirst: if exists -> return; else -> create
const upsertBy = async (model: string, where: any, create: any) => {
    const delegate = (prisma as any)[model];
    if (!delegate) throw new Error(`Unknown model ${model}`);
    const found = await delegate.findFirst({ where } as any);
    if (found) return found;
    return delegate.create({ data: create } as any);
};

const createMany = async (model: string, data: any[]) => {
    if (!data?.length) return;
    const delegate = (prisma as any)[model];
    if (!delegate) throw new Error(`Unknown model ${model}`);
    await delegate.createMany({ data, skipDuplicates: true } as any);
};

async function main() {
    console.log("🌱 Seeding CMSA…");

    // ---------- RBAC ----------
    const roleNames = ["super_admin", "admin", "cashier", "doctor", "radiologist", "lab_tech"];
    await createMany("role", roleNames.map((name) => ({ name })));
    const superAdminRole = await (prisma as any).role.findFirst({ where: { name: "super_admin" } });

    // Owner user (NO authProvider/authSub — matches schema)
    const owner = await upsertBy("user", { email: "owner@cmsa.hn" }, {
        username: "owner",
        fullName: "Administrador CMSA",
        email: "owner@cmsa.hn",
        isActive: true,
    });

    // Ensure role link
    const existingUR = await (prisma as any).userRole.findFirst({
        where: { userId: owner.id, roleId: superAdminRole?.id },
    });
    if (!existingUR) {
        await (prisma as any).userRole.create({
            data: { userId: owner.id, roleId: superAdminRole.id },
        });
    }

    // ---------- Locations / POS infra ----------
    const mainLoc = await upsertBy(
        "location",
        { name: "Clínica Central" },
        { name: "Clínica Central", address: "Blvd. Principal, Santa Ana, HN" },
    );
    const secLoc = await upsertBy(
        "location",
        { name: "Clínica Sucursal" },
        { name: "Clínica Sucursal", address: "Col. Centro, Santa Ana, HN" },
    );

    await upsertBy("cashRegister", { name: "Caja A" }, { name: "Caja A", locationId: mainLoc.id });
    await upsertBy("cashRegister", { name: "Caja B" }, { name: "Caja B", locationId: secLoc.id });

    await upsertBy(
        "posTerminal",
        { name: "POS-Visanet" },
        { name: "POS-Visanet", provider: "Visanet", locationId: mainLoc.id, merchantId: "CMSA-001" },
    );

    await createMany("workstation", [
        { name: "Recepción-1",    type: "frontdesk",     locationId: mainLoc.id, isActive: true },
        { name: "Caja-1",         type: "cashier",       locationId: mainLoc.id, isActive: true },
        { name: "Lab-1",          type: "lab",           locationId: mainLoc.id, isActive: true },
        { name: "Consultorio-1",  type: "doctor_office", locationId: mainLoc.id, isActive: true },
    ]);

    // ---------- Services / Providers / Inventory ----------
    const catLab      = await upsertBy("serviceCategory", { name: "Laboratorio" }, { name: "Laboratorio" });
    const catConsulta = await upsertBy("serviceCategory", { name: "Consulta" },    { name: "Consulta" });
    const catImagen   = await upsertBy("serviceCategory", { name: "Imagen" },      { name: "Imagen" });

    await upsertBy("provider", { fullName: "Dr. Victor Figueroa"  }, { fullName: "Dr. Victor Figueroa",  specialty: "Medicina General", isActive: true });
    await upsertBy("provider", { fullName: "Dra. Ana López"       }, { fullName: "Dra. Ana López",       specialty: "Laboratorio",      isActive: true });
    await upsertBy("provider", { fullName: "Lic. Carlos Ruiz"     }, { fullName: "Lic. Carlos Ruiz",     specialty: "Radiología",       isActive: true });

    await createMany("service", [
        { code: "CONS-GEN", name: "Consulta general",               categoryId: catConsulta.id, price: "350", taxRatePct: "0", requiresProvider: true,  commissionPct: "0"  },
        { code: "ECO-ABD",  name: "Ultrasonido abdominal",          categoryId: catImagen.id,   price: "800", taxRatePct: "0", requiresProvider: true,  commissionPct: "10" },
        { code: "LAB-CBC",  name: "Biometría hemática (CBC)",       categoryId: catLab.id,      price: "220", taxRatePct: "0", requiresProvider: false },
        { code: "LAB-GLU",  name: "Glucosa",                        categoryId: catLab.id,      price: "110", taxRatePct: "0", requiresProvider: false },
        { code: "LAB-LFT",  name: "Pruebas hepáticas (LFT)",        categoryId: catLab.id,      price: "380", taxRatePct: "0", requiresProvider: false },
        { code: "LAB-BMP",  name: "Perfil básico metabólico (BMP)", categoryId: catLab.id,      price: "320", taxRatePct: "0", requiresProvider: false },
        { code: "LAB-UA",   name: "Uroanálisis",                    categoryId: catLab.id,      price: "150", taxRatePct: "0", requiresProvider: false },
    ]);

    // Inventory
    await createMany("inventoryProduct", [
        // existentes
        { sku: "VACU-4ML",         name: "Tubo Vacutainer 4ml", unit: "pieza",   price: "20", taxRatePct: "0" },
        { sku: "AGUJA-21G",        name: "Aguja 21G",           unit: "pieza",   price: "5",  taxRatePct: "0" },
        { sku: "GUANTES-NITRILO",  name: "Guantes de nitrilo",  unit: "par",     price: "10", taxRatePct: "0" },

        // Agujas
        { sku: "AGUJA-1CC",        name: "Aguja 1cc",           unit: "unidad",  price: "3",  taxRatePct: "0" },
        { sku: "AGUJA-3CC",        name: "Aguja 3cc",           unit: "unidad",  price: "5",  taxRatePct: "0" },
        { sku: "AGUJA-5CC",        name: "Aguja 5cc",           unit: "unidad",  price: "6",  taxRatePct: "0" },

        // Varios venopunción/antisépticos
        { sku: "ALCOHOL",          name: "Alcohol",             unit: "botella", price: "50", taxRatePct: "0" },
        { sku: "MARIPOSA",         name: "Mariposa",            unit: "unidad",  price: "15", taxRatePct: "0" },
        { sku: "VENOCLISIS",       name: "Venoclisis",          unit: "unidad",  price: "25", taxRatePct: "0" },

        // Catéter
        { sku: "CATETER-18CC",     name: "Catéter 18cc",        unit: "unidad",  price: "20", taxRatePct: "0" },
        { sku: "CATETER-21CC",     name: "Catéter 21cc",        unit: "unidad",  price: "20", taxRatePct: "0" },
        { sku: "CATETER-23CC",     name: "Catéter 23cc",        unit: "unidad",  price: "20", taxRatePct: "0" },

        // Consumibles
        { sku: "GASAS",            name: "Gasas",               unit: "paquete", price: "30", taxRatePct: "0" },
        { sku: "BAJALENGUA",       name: "Bajalengua",          unit: "unidad",  price: "2",  taxRatePct: "0" },
        { sku: "ISOPOS",           name: "Isopos",              unit: "paquete", price: "10", taxRatePct: "0" },

        // Suturas
        { sku: "HILO-SUTURA-00",   name: "Hilo de sutura 0.0",  unit: "unidad",  price: "40", taxRatePct: "0" },
        { sku: "HILO-SUTURA-06",   name: "Hilo de sutura 0.6",  unit: "unidad",  price: "40", taxRatePct: "0" },

        // Instrumental y varios
        { sku: "BISTURI",          name: "Bisturí",             unit: "unidad",  price: "12", taxRatePct: "0" },
        { sku: "ESPARADRAPO",      name: "Esparadrapo",         unit: "rollo",   price: "25", taxRatePct: "0" },
        { sku: "CURITA",           name: "Curita",              unit: "unidad",  price: "2",  taxRatePct: "0" },
        { sku: "TUBOS-ENSAYO",     name: "Tubos de Ensayo",     unit: "unidad",  price: "8",  taxRatePct: "0" },
    ]);

    const stockProds = await (prisma as any).inventoryProduct.findMany();
    await createMany("productStock",
        stockProds.map((p: any) => ({ productId: p.id, locationId: mainLoc.id, onHand: 100 })),
    );

    // ---------- Specimen Types ----------
    await createMany("specimenType", [
        { name: "Sangre total" }, { name: "Suero" }, { name: "Plasma" }, { name: "Orina" }, { name: "Heces" },
    ]);
    const specimens = await (prisma as any).specimenType.findMany();
    const byName = (n: string) => specimens.find((s: any) => s.name === n);

    // ---------- Lab Instruments ----------
    const celldyn = await upsertBy("labInstrument", { name: "Cell-Dyn 1800" }, { name: "Cell-Dyn 1800", vendor: "Abbott",  model: "1800",  locationId: mainLoc.id, isActive: true });
    const mindray = await upsertBy("labInstrument", { name: "Mindray BA-88A" }, { name: "Mindray BA-88A", vendor: "Mindray", model: "BA-88A", locationId: mainLoc.id, isActive: true });

    // ---------- Test Catalog (Panels + Analytes) ----------
    const panelCBC = await upsertBy("testCatalog", { code: "CBC" }, {
        code: "CBC", name: "Biometría hemática (CBC)", isPanel: true,
        specimenTypeId: byName("Sangre total")?.id, defaultInstrumentId: celldyn.id,
    });
    for (const [code, name, units] of [
        ["WBC","Leucocitos (WBC)","10^3/µL"],["RBC","Eritrocitos (RBC)","10^6/µL"],["HGB","Hemoglobina (HGB)","g/dL"],
        ["HCT","Hematocrito (HCT)","%"],["MCV","Vol. corpuscular medio (MCV)","fL"],["MCH","Hb corpuscular media (MCH)","pg"],
        ["MCHC","Conc. Hb corpuscular media (MCHC)","g/dL"],["RDW","Distribución eritrocitaria (RDW)","%"],["PLT","Plaquetas (PLT)","10^3/µL"],
    ] as const) {
        await upsertBy("testCatalog", { code }, {
            code, name, units,
            specimenTypeId: byName("Sangre total")?.id,
            defaultInstrumentId: celldyn.id,
            parentPanelId: (panelCBC as any).id,
        });
    }

    const panelBMP = await upsertBy("testCatalog", { code: "BMP" }, {
        code: "BMP", name: "Perfil básico metabólico (BMP)", isPanel: true,
        specimenTypeId: byName("Suero")?.id, defaultInstrumentId: mindray.id,
    });
    for (const [code, name, units] of [
        ["GLU","Glucosa","mg/dL"],["BUN","Nitrógeno ureico (BUN)","mg/dL"],["CREA","Creatinina","mg/dL"],
        ["NA","Sodio (Na)","mmol/L"],["K","Potasio (K)","mmol/L"],["CL","Cloruro (Cl)","mmol/L"],
        ["CO2","Dióxido de carbono (CO2)","mmol/L"],["CA","Calcio total","mg/dL"],
    ] as const) {
        await upsertBy("testCatalog", { code }, {
            code, name, units,
            specimenTypeId: byName("Suero")?.id,
            defaultInstrumentId: mindray.id,
            parentPanelId: (panelBMP as any).id,
        });
    }

    const panelLFT = await upsertBy("testCatalog", { code: "LFT" }, {
        code: "LFT", name: "Pruebas hepáticas (LFT)", isPanel: true,
        specimenTypeId: byName("Suero")?.id, defaultInstrumentId: mindray.id,
    });
    for (const [code, name, units] of [
        ["AST","AST (TGO)","U/L"],["ALT","ALT (TGP)","U/L"],["ALP","Fosfatasa alcalina (ALP)","U/L"],
        ["TBIL","Bilirrubina total","mg/dL"],["DBIL","Bilirrubina directa","mg/dL"],["ALB","Albúmina","g/dL"],
    ] as const) {
        await upsertBy("testCatalog", { code }, {
            code, name, units,
            specimenTypeId: byName("Suero")?.id,
            defaultInstrumentId: mindray.id,
            parentPanelId: (panelLFT as any).id,
        });
    }

    const panelUA = await upsertBy("testCatalog", { code: "UA" }, {
        code: "UA", name: "Uroanálisis", isPanel: true, specimenTypeId: byName("Orina")?.id,
    });
    for (const [code, name, units] of [
        ["UACOL","Color",null],["UAASP","Aspecto",null],["UAPRO","Proteína","mg/dL"],["UAGLU","Glucosa (Orina)","mg/dL"],
        ["UAKET","Cetonas","mg/dL"],["UABLD","Sangre",null],["UANIT","Nitritos",null],["UALEU","Leucocitos (Esterasa)",null],
        ["UASG","Densidad",""],["UAPH","pH",""],
    ] as const) {
        await upsertBy("testCatalog", { code }, {
            code, name, units: units ?? null,
            specimenTypeId: byName("Orina")?.id,
            parentPanelId: (panelUA as any).id,
        });
    }

    // ---------- Reference Ranges ----------
    const tests = await (prisma as any).testCatalog.findMany({ where: { isPanel: false } });
    const findTest = (code: string) => tests.find((t: any) => t.code === code);
    const ranges = [
        { test: "HGB", sex: "M", low: 13.0, high: 17.0 },
        { test: "HGB", sex: "F", low: 12.0, high: 15.5 },
        { test: "HCT", low: 38.0, high: 50.0 },
        { test: "WBC", low: 4.0,  high: 11.0 },
        { test: "PLT", low: 150,  high: 450 },
        { test: "MCV", low: 80,   high: 100 },
        { test: "MCH", low: 27,   high: 33 },
        { test: "MCHC", low: 32,  high: 36 },
        { test: "RDW", low: 11.5, high: 14.5 },
        { test: "GLU", low: 70,   high: 100 },
        { test: "NA",  low: 135,  high: 145 },
        { test: "K",   low: 3.5,  high: 5.1 },
        { test: "CL",  low: 98,   high: 107 },
        { test: "CO2", low: 22,   high: 29 },
        { test: "CA",  low: 8.6,  high: 10.2 },
        { test: "BUN", low: 7,    high: 20 },
        { test: "CREA", low: 0.6, high: 1.3 },
        { test: "AST", low: 0,    high: 40 },
        { test: "ALT", low: 0,    high: 41 },
        { test: "ALP", low: 44,   high: 147 },
        { test: "TBIL", low: 0.3, high: 1.2 },
        { test: "DBIL", low: 0.0, high: 0.3 },
        { test: "ALB", low: 3.5,  high: 5.2 },
    ]
        .map((r: any) => ({
            testId: findTest(r.test)?.id,
            sex: r.sex ?? null,
            lowValue: r.low,
            highValue: r.high,
        }))
        .filter((r) => !!r.testId);

    await createMany("referenceRange", ranges as any);

    // ---------- Minimal patient & preclinic sample ----------
    const patient =
        (await (prisma as any).patient.findFirst({ where: { mrn: "MRN-0001" } })) ??
        (await (prisma as any).patient.create({
            data: {
                mrn: "MRN-0001",
                firstName: "Ana",
                lastName: "Gómez",
                sex: "F",
                country: "HN",
                createdById: owner.id,
            },
        }));

    const reqCtx = await (prisma as any).requestContext.create({
        data: {
            session: {
                create: {
                    userId: owner.id,
                    ipAddress: "127.0.0.1",
                    userAgent: "seed-script",
                },
            },
            ipAddress: "127.0.0.1",
            userAgent: "seed-script",
            geoCountry: "HN",
            geoCity: "Santa Ana",
        },
    });

    await (prisma as any).preclinic.create({
        data: {
            patientId: patient.id,
            visitDate: new Date(),
            bloodPressureSystolic: 118,
            bloodPressureDiastolic: 76,
            heartRate: 74,
            temperatureC: "36.8",
            recordedById: owner.id,
            requestContextId: reqCtx.id,
        },
    });

    console.log("✅ Seed complete.");
}

main()
    .catch((e) => {
        console.error("❌ Seed error:", e);
        Deno.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });