import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/appError.js";

export function errorHandler(
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
) {
    if (error instanceof AppError) {
        return res.status(error.statusCode).json({
            error: { message: error.message },
        });
    }

    console.error("[Unhandled application error]", error);

    return res.status(500).json({
        error: { message: "Internal server error" },
    });
}