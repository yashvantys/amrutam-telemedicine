
import { createHash } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/appError.js";

interface BookingInput {
    slotId: string;
}

function hashRequest(input: BookingInput): string {
    return createHash("sha256")
        .update(JSON.stringify({ slotId: input.slotId }))
        .digest("hex");
}

export async function createBooking(
    patientId: string,
    idempotencyKey: string,
    input: BookingInput,
) {
    const requestHash = hashRequest(input);

    try {
        return await prisma.$transaction(async (tx) => {
            await tx.idempotencyKey.create({
                data: {
                    userId: patientId,
                    key: idempotencyKey,
                    requestHash,
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                },
            });

            const slots = await tx.$queryRaw<
                {
                    id: string; doctorId: string; status: string;
                    startTime: Date; endTime: Date
                }[]
            >`
        SELECT id, "doctorId", status, "startTime", "endTime"
        FROM "AvailabilitySlot"
        WHERE id = ${input.slotId}::uuid
        FOR UPDATE
      `;

            const slot = slots[0];

            if (!slot) {
                throw new AppError(404, "Availability slot not found");
            }

            if (slot.status !== "AVAILABLE") {
                throw new AppError(409, "Availability slot is no longer available");
            }

            if (new Date(slot.startTime) <= new Date()) {
                throw new AppError(409, "Availability slot has already started");
            }

            const doctor = await tx.doctor.findUnique({
                where: { id: slot.doctorId },
                select: {
                    isVerified: true,
                    user: { select: { isActive: true } },
                },
            });

            if (!doctor?.isVerified || !doctor.user.isActive) {
                throw new AppError(409, "Doctor is not available for booking");
            }

            const consultation = await tx.consultation.create({
                data: {
                    patientId,
                    doctorId: slot.doctorId,
                    slotId: slot.id,
                    status: "BOOKED",
                },
                select: {
                    id: true,
                    patientId: true,
                    doctorId: true,
                    slotId: true,
                    status: true,
                    createdAt: true,
                },
            });

            await tx.availabilitySlot.update({
                where: { id: slot.id },
                data: { status: "BOOKED" },
            });

            const responseBody = {
                data: {
                    ...consultation,
                    createdAt: consultation.createdAt.toISOString(),
                },
            };
            await tx.idempotencyKey.update({
                where: {
                    userId_key: {
                        userId: patientId,
                        key: idempotencyKey,
                    },
                },
                data: {
                    responseCode: 201,
                    responseBody,
                },
            });

            return {
                statusCode: 201,
                body: responseBody,
                replayed: false,
            };
        });
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
        ) {
            const previous = await prisma.idempotencyKey.findUnique({
                where: {
                    userId_key: {
                        userId: patientId,
                        key: idempotencyKey,
                    },
                },
            });

            if (previous) {
                if (previous.requestHash !== requestHash) {
                    throw new AppError(
                        409,
                        "Idempotency-Key was already used with a different request",
                    );
                }

                if (
                    previous.responseCode !== 201 ||
                    !previous.responseBody
                ) {
                    throw new AppError(409, "Booking request is still unresolved");
                }

                return {
                    statusCode: previous.responseCode,
                    body: previous.responseBody,
                    replayed: true,
                };
            }

            throw new AppError(409, "Availability slot has already been booked");
        }

        throw error;
    }
}
