
import type { Request, Response, NextFunction } from "express";
import { createPrescriptionSchema } from "./prescription.schema.js";
import { createPrescription } from "./prescription.service.js";
import { AppError } from "../../utils/appError.js";

export async function issuePrescription(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const parsed = createPrescriptionSchema.safeParse(req.body);

        if (!parsed.success) {
            return next(new AppError(400, "Invalid prescription data"));
        }

        const prescription = await createPrescription({
            consultationId: parsed.data.consultationId,
            doctorUserId: req.auth!.userId,
            details: parsed.data.details,
        });

        return res.status(201).json({ data: prescription });
    } catch (error) {
        next(error);
    }
}
