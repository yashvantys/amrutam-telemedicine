
import type { Request, Response, NextFunction } from "express";
import { createBookingSchema } from "./booking.schema.js";
import { createBooking } from "./booking.service.js";
import { AppError } from "../../utils/appError.js";

export async function bookSlot(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const parsed = createBookingSchema.safeParse(req.body);
        if (!parsed.success) {
            return next(new AppError(400, "Invalid booking request"));
        }
        const key = req.header("Idempotency-Key");
        if (!key || key.length > 128 || key.trim().length < 8) {
            return next(
                new AppError(400, "A valid Idempotency-Key header is required"),
            );
        }
        const result = await createBooking(
            req.auth!.userId,
            key,
            parsed.data,
        );

        if (result.replayed) {
            res.setHeader("Idempotency-Replayed", "true");
        }

        return res.status(result.statusCode).json(result.body);
    } catch (error) {
        next(error);
    }
}
