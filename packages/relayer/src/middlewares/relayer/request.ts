import { NextFunction, Request, Response } from "express";
import { ValidationError } from "../../exceptions/base.exception.js";
import { validateDetailsQuerystring } from "../../schemes/relayer/details.scheme.js";
import { zRelayRequest } from "../../schemes/relayer/request.scheme.js";
import { validateQuoteBody } from "../../schemes/relayer/quote.scheme.js";

export interface DetailsRequest extends Request { query: DetailsQuery };
export interface RelayRequest extends Request { body: RelayBody };
export interface QuoteRequest extends Request { body: QuoteBody };


// Middleware to validate the details querying
export function validateDetailsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const validation = validateDetailsQuerystring(req.query);
  if (!validation.success) {
    const messages: string[] = [];
    validation.errors?.forEach(e => e?.message ? messages.push(e.message) : undefined);
    next(ValidationError.invalidQuerystring({ message: messages.join("\n") }));
    return;
  }
  next();
}

// Middleware to validate the relay-request body
export function validateRelayRequestMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const validation = validateRelayRequestBody(req.body);
  if (!validation.success) {
    const messages: string[] = [];
    validation.errors?.forEach(e => e?.message ? messages.push(e.message) : undefined);
    next(ValidationError.invalidInput({ message: messages.join("\n") }));
    return;
  }
  next();
}


// Middleware to validate the quote
export function validateQuoteMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const validation = validateQuoteBody(req.body);
  if (!validation.success) {
    const messages: string[] = [];
    validation.errors?.forEach(e => e?.message ? messages.push(e.message) : undefined);
    next(ValidationError.invalidInput({ message: messages.join("\n") }));
    return;
  }
  next();
}
