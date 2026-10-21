
import "dotenv/config";
import { defineConfig } from "vitest/config";

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

export default defineConfig({
    test: {
        environment: "node",
        include: ["tests/integration/**/*.test.ts"],
        clearMocks: true,
        restoreMocks: true,
        testTimeout: 20_000,
        hookTimeout: 20_000,
    },
});
