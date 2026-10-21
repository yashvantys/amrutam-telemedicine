
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";

import authRoutes from "./modules/auth/auth.routes.js";
import availabilityRoutes from "./modules/availability/availability.routes.js";
import bookingRoutes from "./modules/bookings/booking.routes.js";
import consultationRoutes from "./modules/consultations/consultation.routes.js";
import prescriptionRoutes from "./modules/prescriptions/prescription.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.disable("x-powered-by");

if (process.env.TRUST_PROXY === "true") {
    app.set("trust proxy", 1);
}

app.use(
    pinoHttp({
        redact: [
            "req.headers.authorization",
            "req.headers.cookie",
            "res.headers.set-cookie",
        ],
    }),
);

app.use(helmet());

const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(
    cors({
        origin(origin, callback) {
            if (!origin) {
                return callback(null, true);
            }

            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(new Error("Origin not allowed by CORS"));
        },
        credentials: true,
    }),
);

app.use(express.json({ limit: "1mb" }));

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
});

app.get("/health/live", (_req, res) => {
    res.status(200).json({
        status: "ok",
        service: "amrutam-telemedicine",
    });
});

app.use("/v1", apiLimiter);
app.use("/v1/auth", authLimiter);

app.use("/v1/auth", authRoutes);
app.use("/v1/availability", availabilityRoutes);
app.use("/v1/bookings", bookingRoutes);
app.use("/v1/consultations", consultationRoutes);
app.use("/v1/prescriptions", prescriptionRoutes);

app.use(errorHandler);

export default app;
