
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

const mocks = vi.hoisted(() => ({
    createBooking: vi.fn(),
}));

vi.mock("./booking.service.js", () => ({
    createBooking: mocks.createBooking,
}));

import app from "../../app.js";

const JWT_SECRET =
    "test-secret-that-is-at-least-32-characters-long";

function createToken(role: "PATIENT" | "DOCTOR" = "PATIENT") {
    return jwt.sign(
        { role },
        JWT_SECRET,
        {
            subject: "patient-user-123",
            algorithm: "HS256",
            issuer: "amrutam-api",
            audience: "amrutam-client",
            expiresIn: "5m",
        },
    );
}

const validPayload = {
    slotId: "a8a2bc6a-cc2c-4dd0-9d4f-6c0d58fbb1e2",
};

describe("POST /v1/bookings", () => {
    beforeEach(() => {
        mocks.createBooking.mockReset();
    });

    it("returns 401 without a token", async () => {
        const response = await request(app)
            .post("/v1/bookings")
            .set("Idempotency-Key", "booking-key-001")
            .send(validPayload);

        expect(response.status).toBe(401);
    });

    it("returns 403 for a doctor", async () => {
        const response = await request(app)
            .post("/v1/bookings")
            .set("Authorization", `Bearer ${createToken("DOCTOR")}`)
            .set("Idempotency-Key", "booking-key-002")
            .send(validPayload);

        expect(response.status).toBe(403);
        expect(mocks.createBooking).not.toHaveBeenCalled();
    });

    it("returns 400 for an invalid slot ID", async () => {
        const response = await request(app)
            .post("/v1/bookings")
            .set("Authorization", `Bearer ${createToken()}`)
            .set("Idempotency-Key", "booking-key-003")
            .send({ slotId: "not-a-uuid" });

        expect(response.status).toBe(400);
        expect(mocks.createBooking).not.toHaveBeenCalled();
    });

    it("returns 400 when the idempotency key is missing", async () => {
        const response = await request(app)
            .post("/v1/bookings")
            .set("Authorization", `Bearer ${createToken()}`)
            .send(validPayload);

        expect(response.status).toBe(400);
        expect(mocks.createBooking).not.toHaveBeenCalled();
    });

    it("returns 400 when the idempotency key is too short", async () => {
        const response = await request(app)
            .post("/v1/bookings")
            .set("Authorization", `Bearer ${createToken()}`)
            .set("Idempotency-Key", "short")
            .send(validPayload);

        expect(response.status).toBe(400);
        expect(mocks.createBooking).not.toHaveBeenCalled();
    });

    it("returns 201 for a successful booking", async () => {
        const body = {
            data: {
                id: "consultation-123",
                slotId: validPayload.slotId,
                status: "BOOKED",
            },
        };

        mocks.createBooking.mockResolvedValueOnce({
            statusCode: 201,
            body,
            replayed: false,
        });

        const response = await request(app)
            .post("/v1/bookings")
            .set("Authorization", `Bearer ${createToken()}`)
            .set("Idempotency-Key", "booking-key-004")
            .send(validPayload);

        expect(response.status).toBe(201);
        expect(response.body).toEqual(body);
        expect(response.headers["idempotency-replayed"]).toBeUndefined();
        expect(mocks.createBooking).toHaveBeenCalledWith(
            "patient-user-123",
            "booking-key-004",
            validPayload,
        );
    });

    it("sets Idempotency-Replayed for a replayed booking", async () => {
        const body = { data: { id: "consultation-123" } };

        mocks.createBooking.mockResolvedValueOnce({
            statusCode: 201,
            body,
            replayed: true,
        });

        const response = await request(app)
            .post("/v1/bookings")
            .set("Authorization", `Bearer ${createToken()}`)
            .set("Idempotency-Key", "booking-key-005")
            .send(validPayload);

        expect(response.status).toBe(201);
        expect(response.headers["idempotency-replayed"]).toBe("true");
        expect(response.body).toEqual(body);
    });
});
