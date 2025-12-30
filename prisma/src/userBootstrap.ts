import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

export async function ensureLocalUserFromClaims(ctx: {
    sub: string;
    email?: string;
    username?: string;
}) {
    // use sub as the stable identifier
    // We'll store it in User.username if you want, or separate field if you add one.
    // Your current schema uses: username, email, fullName, etc.
    // We’ll try to find by email first (if present), else by username; else create.
    const candidateEmail = ctx.email || null;
    const candidateUsername = ctx.username || ctx.sub;

    let user = await prisma.user.findFirst({
        where: candidateEmail ? { email: candidateEmail } : { username: candidateUsername },
    });

    if (!user) {
        user = await prisma.user.create({
            data: {
                username: candidateUsername,
                fullName: candidateUsername,
                email: candidateEmail ?? `${ctx.sub}@placeholder.local`,
                isActive: true,
            },
        });
    } else {
        // optional: keep email/username in sync if missing
        const updates: any = {};
        if (!user.email && candidateEmail) updates.email = candidateEmail;
        if (!user.username && candidateUsername) updates.username = candidateUsername;
        if (Object.keys(updates).length) {
            user = await prisma.user.update({
                where: { id: user.id },
                data: updates,
            });
        }
    }

    return user;
}