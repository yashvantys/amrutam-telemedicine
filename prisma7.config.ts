
import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl =
  process.env.PRISMA_TEST_DATABASE === "true"
    ? process.env.DATABASE_TEST_URL
    : process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    process.env.PRISMA_TEST_DATABASE === "true"
      ? "DATABASE_TEST_URL is not configured"
      : "DATABASE_URL is not configured",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
