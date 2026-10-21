import type { Request, Response, NextFunction } from "express";
import { registerSchema, loginSchema } from "./auth.schema.js";
import { loginUser, registerUser } from "./auth.service.js";
import { AppError } from "../../utils/appError.js";

export async function register(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const parsed = registerSchema.safeParse(req.body);
        if (!parsed.success) {
            return next(new AppError(400, "Invalid registration data"));
        }
        const user = await registerUser(
            parsed.data.email,
            parsed.data.password,
        );
        res.status(201).json({ data: user });
    } catch (error) {
        next(error);
    }
}

export async function login(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
            return next(new AppError(400, "Invalid login data"));
        }
        const result = await loginUser(
            parsed.data.email,
            parsed.data.password,
        );

        res.status(200).json({ data: result });
    } catch (error) {
        next(error);
    }
}