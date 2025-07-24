import { NextFunction, Request, Response } from "express";
/**
 * Express route handler for relaying requests.
 *
 * @param {Request} req - The incoming HTTP request.
 * @param {Response} res - The HTTP response object.
 * @param {NextFunction} next - The next middleware function.
 */
export declare function relayRequestHandler(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=request.d.ts.map