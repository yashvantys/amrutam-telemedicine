
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "../../generated/prisma/client.js";

const { tx, prisma, previousRecord } = vi.hoisted(() => {
    const tx = {
        idempotencyKey: {
            create: vi.fn(),
            update: vi.fn(),
        },
        $queryRaw: vi.fn(),
        doctor: {
            findUnique: vi.fn(),
        },
        consultation: {
            create: vi.fn(),
        },
        availabilitySlot: {
            update: vi.fn(),
        },
    };

    return {
        tx,
        prisma: {
            $transaction: vi.fn(),
            idempotencyKey: {
                findUnique: vi.fn(),
            },
        },
        previousRecord: { value: null as unknown },
    };
});

vi.mock("../../config/database.js", () => ({ prisma }));

import { createBooking } from "./booking.service.js";

const patientId = "c178b242-edf0-4539-89bb-b5313d656f6e";
const slotId = "a8a2bc6a-cc2c-4dd0-9d4f-6c0d58fbb1e2";
const key = "booking-test-key-001";

const slot = {
    id: slotId,
    doctorId: "ec8968f0-0bd0-4b4b-8e44-8d5ccc997487",
    status: "AVAILABLE",
    startTime: new Date(Date.now() + 60 * 60 * 1000),
    endTime: new Date(Date.now() + 90 * 60 * 1000),
};

const consultation = {
    id: "d6bdba12-b9cf-4dca-a531-0c5c63f9a3d0",
    patientId,
    doctorId: slot.doctorId,
    slotId,
    status: "BOOKED",
    createdAt: new Date("2026-10-21T08:00:00.000Z"),
};

describe("createBooking service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        previousRecord.value = null;

        prisma.$transaction.mockImplementation(
            async (callback: (client: typeof tx) => unknown) => callback(tx),
        );

        tx.idempotencyKey.create.mockResolvedValue({});
        tx.idempotencyKey.update.mockResolvedValue({});
        tx.$queryRaw.mockResolvedValue([slot]);
        tx.doctor.findUnique.mockResolvedValue({
            isVerified: true,
            user: { isActive: true },
        });
        tx.consultation.create.mockResolvedValue(consultation);
        tx.availabilitySlot.update.mockResolvedValue({});
        prisma.idempotencyKey.findUnique.mockImplementation(
            async () => previousRecord.value,
        );
    });

    it("creates a booking and stores the idempotent response", async () => {
        const result = await createBooking(patientId, key, { slotId });

        expect(result.statusCode).toBe(201);
        expect(result.replayed).toBe(false);
        expect(tx.consultation.create).toHaveBeenCalledTimes(1);
        expect(tx.availabilitySlot.update).toHaveBeenCalledWith({
            where: { id: slotId },
            data: { status: "BOOKED" },
        });
        expect(tx.idempotencyKey.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    responseCode: 201,
                    responseBody: expect.any(Object),
                }),
            }),
        );
    });

    it("returns 404 when the slot does not exist", async () => {
        tx.$queryRaw.mockResolvedValue([]);

        await expect(
            createBooking(patientId, key, { slotId }),
        ).rejects.toMatchObject({ statusCode: 404 });

        expect(tx.consultation.create).not.toHaveBeenCalled();
    });

    it("returns 409 when the slot is already booked", async () => {
        tx.$queryRaw.mockResolvedValue([{ ...slot, status: "BOOKED" }]);

        await expect(
            createBooking(patientId, key, { slotId }),
        ).rejects.toMatchObject({ statusCode: 409 });

        expect(tx.consultation.create).not.toHaveBeenCalled();
    });

    it("returns 409 when the doctor is not verified", async () => {
        tx.doctor.findUnique.mockResolvedValue({
            isVerified: false,
            user: { isActive: true },
        });

        await expect(
            createBooking(patientId, key, { slotId }),
        ).rejects.toMatchObject({ statusCode: 409 });

        expect(tx.consultation.create).not.toHaveBeenCalled();
    });

    it("returns 409 when the doctor is inactive", async () => {
        tx.doctor.findUnique.mockResolvedValue({
            isVerified: true,
            user: { isActive: false },
        });

        await expect(
            createBooking(patientId, key, { slotId }),
        ).rejects.toMatchObject({ statusCode: 409 });

        expect(tx.consultation.create).not.toHaveBeenCalled();
    });

    it("returns 409 if a key is reused with a different request", async () => {
        const differentSlotId = "b9b3bc6a-cc2c-4dd0-9d4f-6c0d58fbb1e2";

        // A real Prisma P2002 error is needed to exercise the duplicate-key branch.
        const duplicateError = new Prisma.PrismaClientKnownRequestError(
            "Unique constraint failed",
            { code: "P2002", clientVersion: "7.10.1" },
        );

        tx.idempotencyKey.create.mockRejectedValue(duplicateError);
        previousRecord.value = {
            requestHash: "different-request-hash",
            responseCode: 201,
            responseBody: { data: { id: "previous-booking" } },
        };

        await expect(
            createBooking(patientId, key, { slotId: differentSlotId }),
        ).rejects.toMatchObject({ statusCode: 409 });

        expect(tx.consultation.create).not.toHaveBeenCalled();
    });
});
