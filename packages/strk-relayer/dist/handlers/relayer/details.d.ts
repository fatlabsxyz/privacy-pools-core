import { NextFunction, Request, Response } from "express";
/**
 * Handler for the relayer details endpoint.
 * Supports querying by chain ID and asset address.
 * Returns details about the fee structure for a specific asset on a specific chain.
 *
 * @param {Request} req - The HTTP request.
 * @param {Response} res - The HTTP response.
 * @param {NextFunction} next - The next middleware function.
 */
export declare function relayerDetailsHandler(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=details.d.ts.map