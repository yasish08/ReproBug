import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;
export const prisma = globalForPrisma.reprobugPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.reprobugPrisma = prisma;
}
