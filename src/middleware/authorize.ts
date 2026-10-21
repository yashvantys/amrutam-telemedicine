import type { Request, Response, NextFunction } from "express";
import type { AuthUser } from "./authenticate.js";
import { AppError } from "../utils/appError.js";

type Role = AuthUser["role"];

export function authorize(...allowedRoles: Role[]) {
    return (req: Request, _res: Response, next: NextFunction) => {
        if (!req.auth) {
            return next(new AppError(401, "Authentication required"));
        }

        if (!allowedRoles.includes(req.auth.role)) {
            return next(new AppError(403, "Insufficient permissions"));
        }

        next();
    };
}