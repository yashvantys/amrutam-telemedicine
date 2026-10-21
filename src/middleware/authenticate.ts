import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../utils/appError.js";

const jwtSecret = process.env.JWT_ACCESS_SECRET;

if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error("JWT_ACCESS_SECRET must be at least 32 characters");
}

export interface AuthUser {
    userId: string;
    role: "PATIENT" | "DOCTOR" | "ADMIN";
}

declare global {
    namespace Express {
        interface Request {
            auth?: AuthUser;
        }
    }
}

export function authenticate(
    req: Request,
    _res: Response,
    next: NextFunction,
) {
    const authorization = req.headers.authorization;
    const [scheme, token] = authorization?.split(" ") ?? [];

    if (scheme !== "Bearer" || !token) {
        return next(new AppError(401, "Authentication required"));
    }

    try {
        const payload = jwt.verify(token, jwtSecret!, {
            algorithms: ["HS256"],
            issuer: "amrutam-api",
            audience: "amrutam-client",
        });

        if (
            typeof payload === "string" ||
            typeof payload.sub !== "string" ||
            !["PATIENT", "DOCTOR", "ADMIN"].includes(
                String(payload.role),
            )
        ) {
            return next(new AppError(401, "Invalid access token"));
        }

        req.auth = {
            userId: payload.sub,
            role: payload.role as AuthUser["role"],
        };

        next();
    } catch {
        next(new AppError(401, "Invalid or expired access token"));
    }
}