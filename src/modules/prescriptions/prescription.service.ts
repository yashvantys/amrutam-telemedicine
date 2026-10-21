
import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/appError.js";

interface CreatePrescriptionInput {
    consultationId: string;
    doctorUserId: string;
    details: {
        medications: {
            name: string;
            dosage: string;
            frequency: string;
            duration: string;
        }[];
        instructions?: string;
    };
}

export async function createPrescription(
    input: CreatePrescriptionInput,
) {
    return prisma.$transaction(async (tx) => {
        const consultation = await tx.consultation.findUnique({
            where: { id: input.consultationId },
            select: {
                id: true,
                status: true,
                doctor: {
                    select: {
                        id: true,
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
            consultation.doctor.userId !== input.doctorUserId ||
            !consultation.doctor.isVerified
        ) {
            throw new AppError(
                403,
                "Only the assigned verified doctor can prescribe",
            );
        }

        if (consultation.status !== "IN_PROGRESS") {
            throw new AppError(
                409,
                "Prescription requires an in-progress consultation",
            );
        }

        const prescription = await tx.prescription.create({
            data: {
                consultationId: consultation.id,
                doctorId: consultation.doctor.id,
                details: input.details,
            },
            select: {
                id: true,
                consultationId: true,
                details: true,
                createdAt: true,
            },
        });

        await tx.auditLog.create({
            data: {
                actorId: input.doctorUserId,
                action: "PRESCRIPTION_CREATED",
                resource: "Prescription",
                resourceId: prescription.id,
            },
        });

        return prescription;
    });
}
