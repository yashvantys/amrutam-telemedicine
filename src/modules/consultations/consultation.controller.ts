
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { changeConsultationStatus } from "./consultation.service.js";
import { AppError } from "../../utils/appError.js";

const paramsSchema = z.object({
    id: z.string().uuid(),
});

function handleTransition(action: "START" | "COMPLETE") {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const parsed = paramsSchema.safeParse(req.params);

            if (!parsed.success) {
                throw new AppError(400, "Invalid consultation ID");
            }

            const consultation = await changeConsultationStatus(
                parsed.data.id,
                req.auth!.userId,
                action,
            );

            return res.status(200).json({ data: consultation });
        } catch (error) {
            next(error);
        }
    };
}

export const startConsultation = handleTransition("START");
export const completeConsultation = handleTransition("COMPLETE");
