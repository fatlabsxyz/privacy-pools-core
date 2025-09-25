import { NextFunction, Request, Response } from "express";
import { ValidationError } from "../../exceptions/base.exception.js";
import { validateDetailsQuerystring } from "../../schemes/relayer/details.scheme.js";
import { validateRelayRequestBody } from "../../schemes/relayer/request.scheme.js";
import { validateQuoteBody } from "../../schemes/relayer/quote.scheme.js";
import { validateBatchRelayRequestBody } from "../../schemes/relayer/batchRequest.scheme.js";
import { validateBatchRelayQuoteBody } from "../../schemes/relayer/batchQuote.scheme.js";

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

// Middleware to validate batch relay request
export function validateBatchRelayRequestMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const validation = validateBatchRelayRequestBody(req.body);
  if (!validation.success) {
    const messages: string[] = [];
    validation.errors?.forEach(e => e?.message ? messages.push(e.message) : undefined);
    next(ValidationError.invalidInput({ message: messages.join("\n") }));
    return;
  }
  next();
}

// Middleware to validate batch relay quote
export function validateBatchRelayQuoteMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const validation = validateBatchRelayQuoteBody(req.body);
  if (!validation.success) {
    const messages: string[] = [];
    validation.errors?.forEach(e => e?.message ? messages.push(e.message) : undefined);
    next(ValidationError.invalidInput({ message: messages.join("\n") }));
    return;
  }
  next();
}
