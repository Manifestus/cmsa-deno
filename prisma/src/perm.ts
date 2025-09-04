// prisma/src/perm.ts
export type Permission =
    | "cash.session.open"
    | "cash.session.close"
    | "cash.session.read"
    | "cash.movement.create"
    | "cash.movement.read"
    | "pos.checkout"
    | "pos.refund"
    | "audit.read";

const ALL: Permission[] = [
    "cash.session.open",
    "cash.session.close",
    "cash.session.read",
    "cash.movement.create",
    "cash.movement.read",
    "pos.checkout",
    "pos.refund",
    "audit.read",
];

// Role → Permissions (granular, easy to extend)
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
    super_admin: ALL,
    admin: [
        "cash.session.read",
        "cash.movement.read",
        "audit.read",
    ],
    cashier: [
        "cash.session.open",
        "cash.session.close",
        "cash.session.read",
        "cash.movement.create",
        "cash.movement.read",
        "pos.checkout",
    ],
    doctor: [],
    radiologist: [],
    lab_tech: [],
};

export function expandPermsFromRoles(roles: string[] | undefined): Permission[] {
    if (!roles?.length) return [];
    const bag = new Set<Permission>();
    for (const r of roles) {
        const key = r.toLowerCase();
        for (const p of (ROLE_PERMISSIONS[key] ?? [])) bag.add(p);
    }
    return [...bag];
}