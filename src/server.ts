
import "dotenv/config";
import app from "./app.js";
import { prisma } from "./config/database.js";

const PORT = Number(process.env.PORT ?? 3000);

async function bootstrap() {
    try {
        // Verify PostgreSQL before accepting requests.
        await prisma.$connect();
        await prisma.$queryRaw`SELECT 1`;

        const server = app.listen(PORT, () => {
            console.log(`Amrutam API listening on port ${PORT}`);
        });

        const shutdown = (signal: string) => {
            console.log(`${signal} received. Shutting down...`);

            server.close(async (error) => {
                try {
                    await prisma.$disconnect();
                } finally {
                    if (error) {
                        console.error("HTTP server shutdown failed:", error);
                        process.exitCode = 1;
                    }
                }
            });
        };

        process.once("SIGINT", () => shutdown("SIGINT"));
        process.once("SIGTERM", () => shutdown("SIGTERM"));
    } catch (error) {
        console.error("Application startup failed:", error);
        await prisma.$disconnect();
        process.exitCode = 1;
    }
}

void bootstrap();
