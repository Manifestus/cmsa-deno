import { PrismaClient } from "./src/generated/prisma/client.ts";

export const prisma = new PrismaClient({
  datasourceUrl: Deno.env.get("DATABASE_URL") ?? "",
});