import { z } from "zod";

export const createSlotSchema = z
    .object({
        startTime: z.string().datetime({ offset: true }),
        endTime: z.string().datetime({ offset: true }),
    })
    .refine(
        (slot) =>
            new Date(slot.endTime).getTime() >
            new Date(slot.startTime).getTime(),
        {
            message: "endTime must be after startTime",
            path: ["endTime"],
        },
    )
    .refine(
        (slot) =>
            new Date(slot.startTime).getTime() > Date.now(),
        {
            message: "startTime must be in the future",
            path: ["startTime"],
        },
    );