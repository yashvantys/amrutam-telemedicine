
import { z } from "zod";

export const createPrescriptionSchema = z.object({
    consultationId: z.string().uuid(),
    details: z.object({
        medications: z.array(
            z.object({
                name: z.string().trim().min(1).max(200),
                dosage: z.string().trim().min(1).max(100),
                frequency: z.string().trim().min(1).max(100),
                duration: z.string().trim().min(1).max(100),
            }),
        ).min(1).max(30),
        instructions: z.string().max(2000).optional(),
    }),
});
