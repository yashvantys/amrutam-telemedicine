
import type { Request, Response, NextFunction } from "express";
import { createSlotSchema } from "./availability.schema.js";
import {
    createAvailabilitySlot,
    searchAvailableSlots,
} from "./availability.service.js";
import { AppError } from "../../utils/appError.js";

export async function createSlot(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const parsed = createSlotSchema.safeParse(req.body);
        if (!parsed.success) {
            return next(new AppError(400, "Invalid availability data"));
        }
        const slot = await createAvailabilitySlot(
            req.auth!.userId,
            parsed.data,
        );
        return res.status(201).json({ data: slot });
    } catch (error) {
        next(error);
    }
}

export async function listSlots(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const date = req.query.date;
        if (typeof date !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return next(
                new AppError(400, "date must use YYYY-MM-DD format"),
            );
        }
        const slots = await searchAvailableSlots(date);
        return res.status(200).json({
            data: slots,
            count: slots.length,
        });
    } catch (error) {
        next(error);
    }
}
