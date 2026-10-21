
import { randomUUID } from "node:crypto";
import {
    afterAll,
    beforeAll,
    describe,
    expect,
    it,
} from "vitest";

import { createBooking } from "../../src/modules/bookings/booking.service.js";
import { testPrisma } from "./prisma-test-client.js";

describe("Booking PostgreSQL integration", () => {
    const suffix = randomUUID();

    const patientAId = randomUUID();
    const patientBId = randomUUID();
    const doctorUserId = randomUUID();
    const doctorId = randomUUID();

    // Dedicated slots keep tests independent.
    const concurrentSlotId = randomUUID();
    const retrySlotId = randomUUID();
    const rollbackSlotId = randomUUID();
    const idempotencyOriginalSlotId = randomUUID();
    const idempotencyConflictSlotId = randomUUID();

    const patientAEmail = `patient-a-${suffix}@integration.test`;
    const patientBEmail = `patient-b-${suffix}@integration.test`;
    const doctorEmail = `doctor-${suffix}@integration.test`;

    const slotIds = [
        concurrentSlotId,
        retrySlotId,
        rollbackSlotId,
        idempotencyOriginalSlotId,
        idempotencyConflictSlotId,
    ];

    beforeAll(async () => {
        await testPrisma.$connect();

        await testPrisma.user.createMany({
            data: [
                {
                    id: patientAId,
                    email: patientAEmail,
                    passwordHash: "integration-test-hash",
                    role: "PATIENT",
                },
                {
                    id: patientBId,
                    email: patientBEmail,
                    passwordHash: "integration-test-hash",
                    role: "PATIENT",
                },
                {
                    id: doctorUserId,
                    email: doctorEmail,
                    passwordHash: "integration-test-hash",
                    role: "DOCTOR",
                },
            ],
        });

        await testPrisma.doctor.create({
            data: {
                id: doctorId,
                userId: doctorUserId,
                specialization: "General Medicine",
                isVerified: true,
            },
        });

        const now = Date.now();

        await testPrisma.availabilitySlot.createMany({
            data: slotIds.map((id, index) => {
                const startTime = new Date(
                    now + (index + 1) * 60 * 60 * 1000,
                );

                return {
                    id,
                    doctorId,
                    startTime,
                    endTime: new Date(startTime.getTime() + 30 * 60 * 1000),
                    status: "AVAILABLE" as const,
                };
            }),
        });
    });

    afterAll(async () => {
        try {
            await testPrisma.idempotencyKey.deleteMany({
                where: {
                    userId: { in: [patientAId, patientBId] },
                },
            });

            await testPrisma.consultation.deleteMany({
                where: { slotId: { in: slotIds } },
            });

            await testPrisma.availabilitySlot.deleteMany({
                where: { id: { in: slotIds } },
            });

            await testPrisma.doctor.deleteMany({
                where: { id: doctorId },
            });

            await testPrisma.user.deleteMany({
                where: {
                    id: { in: [patientAId, patientBId, doctorUserId] },
                },
            });
        } finally {
            await testPrisma.$disconnect();
        }
    });

    it("allows only one patient to book a slot concurrently", async () => {
        const results = await Promise.allSettled([
            createBooking(
                patientAId,
                `concurrent-a-${suffix}`,
                { slotId: concurrentSlotId },
                testPrisma,
            ),
            createBooking(
                patientBId,
                `concurrent-b-${suffix}`,
                { slotId: concurrentSlotId },
                testPrisma,
            ),
        ]);

        const successful = results.filter(
            (result) =>
                result.status === "fulfilled" &&
                result.value.statusCode === 201,
        );

        const rejected = results.filter(
            (result) => result.status === "rejected",
        );

        expect(successful).toHaveLength(1);
        expect(rejected).toHaveLength(1);

        const consultations = await testPrisma.consultation.findMany({
            where: { slotId: concurrentSlotId },
        });

        expect(consultations).toHaveLength(1);
        expect(consultations[0].status).toBe("BOOKED");

        const slot = await testPrisma.availabilitySlot.findUniqueOrThrow({
            where: { id: concurrentSlotId },
        });

        expect(slot.status).toBe("BOOKED");
    });

    it("returns the original response when the same request is retried", async () => {
        const idempotencyKey = `retry-${suffix}`;

        const first = await createBooking(
            patientAId,
            idempotencyKey,
            { slotId: retrySlotId },
            testPrisma,
        );

        const second = await createBooking(
            patientAId,
            idempotencyKey,
            { slotId: retrySlotId },
            testPrisma,
        );

        expect(first.statusCode).toBe(201);
        expect(second.statusCode).toBe(201);
        expect(second.replayed).toBe(true);
        expect(second.body).toEqual(first.body);

        const count = await testPrisma.consultation.count({
            where: { slotId: retrySlotId },
        });

        expect(count).toBe(1);
    });

    it("rolls back the idempotency record when a slot is unavailable", async () => {
        await createBooking(
            patientAId,
            `initial-rollback-${suffix}`,
            { slotId: rollbackSlotId },
            testPrisma,
        );

        const failedKey = `unavailable-${suffix}`;

        await expect(
            createBooking(
                patientBId,
                failedKey,
                { slotId: rollbackSlotId },
                testPrisma,
            ),
        ).rejects.toMatchObject({
            statusCode: 409,
        });

        const failedRecord = await testPrisma.idempotencyKey.findUnique({
            where: {
                userId_key: {
                    userId: patientBId,
                    key: failedKey,
                },
            },
        });

        expect(failedRecord).toBeNull();

        const consultations = await testPrisma.consultation.findMany({
            where: { slotId: rollbackSlotId },
        });

        expect(consultations).toHaveLength(1);
        expect(consultations[0].patientId).toBe(patientAId);
    });

    it("rejects reuse of an idempotency key with a different payload", async () => {
        const idempotencyKey = `conflict-${suffix}`;

        const first = await createBooking(
            patientAId,
            idempotencyKey,
            { slotId: idempotencyOriginalSlotId },
            testPrisma,
        );

        expect(first.statusCode).toBe(201);

        await expect(
            createBooking(
                patientAId,
                idempotencyKey,
                { slotId: idempotencyConflictSlotId },
                testPrisma,
            ),
        ).rejects.toMatchObject({
            statusCode: 409,
        });

        const originalBooking = await testPrisma.consultation.findMany({
            where: {
                slotId: idempotencyOriginalSlotId,
                patientId: patientAId,
            },
        });

        expect(originalBooking).toHaveLength(1);

        const conflictingBooking = await testPrisma.consultation.findMany({
            where: {
                slotId: idempotencyConflictSlotId,
                patientId: patientAId,
            },
        });

        expect(conflictingBooking).toHaveLength(0);
    });
});
