import { Handler, Request, Response } from "express";
import { isSysadminReadOnly, UserRole } from "../modules/auth";
import { pageNotFound } from "../models/admin-portal-v3/main.model";

type ErrorHandler = (req: Request, res: Response) => void;

export const errorHandlers = {
    statusForbidden(message: string): ErrorHandler {
        return (_, res) => res.status(403).send(message);
    },
    renderErrorPage(message: string): ErrorHandler {
        return (req, res) => pageNotFound(req, res, message);
    }
};

export function requireRole(requiredRole: UserRole, errorHandler: ErrorHandler): Handler {
    return function (req, res, next) {
        if (req.userRole >= requiredRole) {
            return next();
        }

        errorHandler(req, res);
    };
}

export function requireSysAdminWriteMode(): Handler {
    return function (req, res, next) {
        if (req.userRole !== UserRole.SystemAdmin || !isSysadminReadOnly(req.user, req.account)) {
            return next();
        }

        res.status(403).send("System Admin in read only mode");
    };
}
