
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client.js";

const databaseUrl = process.env.DATABASE_TEST_URL;

if (!databaseUrl) {
    throw new Error("DATABASE_TEST_URL is not configured");
}

const parsedUrl = new URL(databaseUrl);

if (parsedUrl.pathname !== "/amrutam_test_db") {
    throw new Error(
        "Integration tests may only use amrutam_test_db",
    );
}

const adapter = new PrismaPg({
    connectionString: databaseUrl,
});

export const testPrisma = new PrismaClient({ adapter });
