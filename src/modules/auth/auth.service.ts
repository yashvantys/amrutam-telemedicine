import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { prisma } from "../../config/database.js";
import { AppError } from "../../utils/appError.js";

const jwtSecret = process.env.JWT_ACCESS_SECRET;

if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error("JWT_ACCESS_SECRET must be at least 32 characters");
}

const jwtTtl = process.env.JWT_ACCESS_TTL ?? "15m";

export async function registerUser(
    email: string,
    password: string,
) {
    const normalizedEmail = email.trim().toLowerCase();

    const existing = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
    });

    if (existing) {
        throw new AppError(409, "Email is already registered");
    }

    const passwordHash = await argon2.hash(password);
    try {
        return await prisma.user.create({
            data: {
                email: normalizedEmail,
                passwordHash,
                role: "PATIENT",
            },
            select: {
                id: true,
                email: true,
                role: true,
                createdAt: true,
            },
        });
    } catch (error) {
        if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "P2002"
        ) {
            throw new AppError(409, "Email is already registered");
        }

        throw error;
    }
}

export async function loginUser(
    email: string,
    password: string,
) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
    });

    if (
        !user ||
        !user.isActive ||
        !(await argon2.verify(user.passwordHash, password))
    ) {
        throw new AppError(401, "Invalid email or password");
    }
    if (user.mfaEnabled) {
        throw new AppError(403, "MFA verification is required");
    }

    const accessToken = jwt.sign(
        {
            sub: user.id,
            role: user.role,
            jti: randomUUID(),
        },
        jwtSecret!,
        {
            algorithm: "HS256",
            expiresIn: jwtTtl as jwt.SignOptions["expiresIn"],
            issuer: "amrutam-api",
            audience: "amrutam-client",
        },
    );

    return {
        accessToken,
        tokenType: "Bearer",
        expiresIn: jwtTtl,
    };
}