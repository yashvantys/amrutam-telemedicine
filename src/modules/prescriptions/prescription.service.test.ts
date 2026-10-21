
import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx, prisma } = vi.hoisted(() => {
    const tx = {
        consultation: {
            findUnique: vi.fn(),
        },
        prescription: {
            create: vi.fn(),
        },
        auditLog: {
            create: vi.fn(),
        },
    };

    const prisma = {
        $transaction: vi.fn(),
    };

    return { tx, prisma };
});

vi.mock("../../config/database.js", () => ({ prisma }));

import { createPrescription } from "./prescription.service.js";
import { AppError } from "../../utils/appError.js";

const input = {
    consultationId: "consultation-123",
    doctorUserId: "doctor-user-123",
    details: {
        medications: [
            {
                name: "Example medicine",
                dosage: "One tablet",
                frequency: "Twice daily",
                duration: "5 days",
            },
        ],
    },
};

const consultation = {
    id: input.consultationId,
    status: "IN_PROGRESS",
    doctor: {
        id: "doctor-123",
        userId: input.doctorUserId,
        isVerified: true,
    },
};

describe("createPrescription service", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Execute the transaction callback against our mocked transaction.
        prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) =>
            callback(tx),
        );

        tx.consultation.findUnique.mockResolvedValue(consultation);
        tx.prescription.create.mockResolvedValue({
            id: "prescription-123",
            consultationId: input.consultationId,
            details: input.details,
            createdAt: new Date("2026-10-21T08:00:00.000Z"),
        });
        tx.auditLog.create.mockResolvedValue({});
    });

    it("creates a prescription and audit record in one transaction", async () => {
        const result = await createPrescription(input);

        expect(result.id).toBe("prescription-123");
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(tx.prescription.create).toHaveBeenCalledTimes(1);
        expect(tx.auditLog.create).toHaveBeenCalledWith({
            data: {
                actorId: input.doctorUserId,
                action: "PRESCRIPTION_CREATED",
                resource: "Prescription",
                resourceId: "prescription-123",
            },
        });
    });

    it("throws 404 when consultation does not exist", async () => {
        tx.consultation.findUnique.mockResolvedValue(null);

        await expect(createPrescription(input)).rejects.toMatchObject({
            statusCode: 404,
            message: "Consultation not found",
        });

        expect(tx.prescription.create).not.toHaveBeenCalled();
        expect(tx.auditLog.create).not.toHaveBeenCalled();
    });

    it("rejects a different doctor", async () => {
        tx.consultation.findUnique.mockResolvedValue({
            ...consultation,
            doctor: { ...consultation.doctor, userId: "another-doctor" },
        });

        await expect(createPrescription(input)).rejects.toMatchObject({
            statusCode: 403,
        });

        expect(tx.prescription.create).not.toHaveBeenCalled();
    });

    it("rejects an unverified doctor", async () => {
        tx.consultation.findUnique.mockResolvedValue({
            ...consultation,
            doctor: { ...consultation.doctor, isVerified: false },
        });

        await expect(createPrescription(input)).rejects.toMatchObject({
            statusCode: 403,
        });

        expect(tx.prescription.create).not.toHaveBeenCalled();
    });

    it("rejects a consultation that is not in progress", async () => {
        tx.consultation.findUnique.mockResolvedValue({
            ...consultation,
            status: "COMPLETED",
        });

        await expect(createPrescription(input)).rejects.toMatchObject({
            statusCode: 409,
        });

        expect(tx.prescription.create).not.toHaveBeenCalled();
    });

    it("propagates an audit failure so the transaction can roll back", async () => {
        tx.auditLog.create.mockRejectedValue(new Error("Audit write failed"));

        await expect(createPrescription(input)).rejects.toThrow(
            "Audit write failed",
        );
    });
});
