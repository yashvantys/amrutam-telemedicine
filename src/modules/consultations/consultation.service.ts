
import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/appError.js";
import type { ConsultationStatus } from "../../generated/prisma/client.js";

export async function changeConsultationStatus(
    consultationId: string,
    doctorUserId: string,
    action: "START" | "COMPLETE",
) {
    const from: ConsultationStatus =
        action === "START" ? "BOOKED" : "IN_PROGRESS";

    const to: ConsultationStatus =
        action === "START" ? "IN_PROGRESS" : "COMPLETED";

    return prisma.$transaction(async (tx) => {
        const consultation = await tx.consultation.findUnique({
            where: { id: consultationId },
            select: {
                id: true,
                status: true,
                doctor: {
                    select: {
                        userId: true,
                        isVerified: true,
                    },
                },
            },
        });

        if (!consultation) {
            throw new AppError(404, "Consultation not found");
        }

        if (
            consultation.doctor.userId !== doctorUserId ||
            !consultation.doctor.isVerified
        ) {
            throw new AppError(403, "Access denied");
        }

        if (consultation.status !== from) {
            throw new AppError(
                409,
                `Consultation must be ${from} before ${action}`,
            );
        }

        // Conditional update protects against concurrent state changes.
        const result = await tx.consultation.updateMany({
            where: {
                id: consultationId,
                status: from,
            },
            data: {
                status: to,
            },
        });

        if (result.count !== 1) {
            throw new AppError(409, "Consultation state changed concurrently");
        }

        return tx.consultation.findUniqueOrThrow({
            where: { id: consultationId },
            select: {
                id: true,
                patientId: true,
                doctorId: true,
                status: true,
                updatedAt: true,
            },
        });
    });
}
