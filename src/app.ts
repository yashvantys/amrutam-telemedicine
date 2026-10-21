import express from "express";
import authRoutes from "./modules/auth/auth.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import availabilityRoutes from "./modules/availability/availability.routes.js";
import bookingRoutes from "./modules/bookings/booking.routes.js";
import consultationRoutes from "./modules/consultations/consultation.routes.js";
import prescriptionRoutes from "./modules/prescriptions/prescription.routes.js";
const app = express();

app.use(express.json());
app.use("/v1/auth", authRoutes);
app.use("/v1/availability", availabilityRoutes);
app.use("/v1/prescriptions", prescriptionRoutes);
app.use("/v1/consultations", consultationRoutes);
app.use("/v1/bookings", bookingRoutes);
app.use(errorHandler);

app.get("/health/live", (_req, res) => {
    res.status(200).json({
        status: "ok",
        service: "amrutam-telemedicine",
    });
});

export default app;