
import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/appError.js";

interface CreateSlotInput {
    startTime: string;
    endTime: string;
}

export async function createAvailabilitySlot(
    userId: string,
    input: CreateSlotInput,
) {
    const doctor = await prisma.doctor.findUnique({
        where: { userId },
        select: {
            id: true,
            isVerified: true,
        },
    });

    if (!doctor || !doctor.isVerified) {
        throw new AppError(403, "Verified doctor access required");
    }

    const startTime = new Date(input.startTime);
    const endTime = new Date(input.endTime);

    if (endTime <= startTime) {
        throw new AppError(400, "Invalid availability time range");
    }

    if (startTime <= new Date()) {
        throw new AppError(400, "Availability must be in the future");
    }
   
    return prisma.availabilitySlot.create({
        data: {
            doctorId: doctor.id,
            startTime,
            endTime,
            status: "AVAILABLE",
        },
    });
}

export async function searchAvailableSlots(date: string) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    if (Number.isNaN(start.getTime())) {
        throw new AppError(400, "Invalid date");
    }

    return prisma.availabilitySlot.findMany({
        where: {
            status: "AVAILABLE",
            startTime: { gte: start, lt: end },
            doctor: { isVerified: true },
        },
        select: {
            id: true,
            startTime: true,
            endTime: true,
            doctor: {
                select: {
                    id: true,
                    specialization: true,
                },
            },
        },
        orderBy: { startTime: "asc" },
        take: 100,
    });
}
