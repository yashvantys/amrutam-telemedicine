
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

const mocks = vi.hoisted(() => ({
    createPrescription: vi.fn(),
}));

vi.mock("./prescription.service.js", () => ({
    createPrescription: mocks.createPrescription,
}));

import app from "../../app.js";

const JWT_SECRET =
    "test-secret-that-is-at-least-32-characters-long";

function createToken(role: "DOCTOR" | "PATIENT" = "DOCTOR") {
    return jwt.sign(
        { role },
        JWT_SECRET,
        {
            subject: "doctor-user-123",
            algorithm: "HS256",
            issuer: "amrutam-api",
            audience: "amrutam-client",
            expiresIn: "5m",
        },
    );
}

const validPayload = {
    consultationId: "a8a2bc6a-cc2c-4dd0-9d4f-6c0d58fbb1e2",
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

describe("POST /v1/prescriptions", () => {
    beforeEach(() => {
        mocks.createPrescription.mockReset();
    });

    it("returns 401 without a token", async () => {
        const response = await request(app)
            .post("/v1/prescriptions")
            .send(validPayload);

        expect(response.status).toBe(401);
    });

    it("returns 403 for a patient", async () => {
        const response = await request(app)
            .post("/v1/prescriptions")
            .set("Authorization", `Bearer ${createToken("PATIENT")}`)
            .send(validPayload);

        expect(response.status).toBe(403);
        expect(mocks.createPrescription).not.toHaveBeenCalled();
    });

    it("returns 400 for an invalid payload", async () => {
        const response = await request(app)
            .post("/v1/prescriptions")
            .set("Authorization", `Bearer ${createToken()}`)
            .send({
                consultationId: "not-a-uuid",
                details: { medications: [] },
            });

        expect(response.status).toBe(400);
        expect(mocks.createPrescription).not.toHaveBeenCalled();
    });

    it("returns 201 for a valid doctor request", async () => {
        const created = {
            id: "prescription-123",
            consultationId: validPayload.consultationId,
            details: validPayload.details,
            createdAt: "2026-10-21T08:00:00.000Z",
        };

        mocks.createPrescription.mockResolvedValueOnce(created);

        const response = await request(app)
            .post("/v1/prescriptions")
            .set("Authorization", `Bearer ${createToken()}`)
            .send(validPayload);

        expect(response.status).toBe(201);
        expect(response.body.data.id).toBe("prescription-123");
        expect(mocks.createPrescription).toHaveBeenCalledWith({
            consultationId: validPayload.consultationId,
            doctorUserId: "doctor-user-123",
            details: validPayload.details,
        });
    });
});
