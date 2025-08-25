import { Router } from "express";
import {
  relayerDetailsHandler,
  relayQuoteHandler,
  relayRequestHandler,
  batchRelayQuoteHandler,
  batchRelayRequestHandler,
} from "../handlers/index.js";
import {
  validateDetailsMiddleware,
  validateQuoteMiddleware,
  validateRelayRequestMiddleware,
  validateBatchRelayRequestMiddleware,
  validateBatchRelayQuoteMiddleware,
} from "../middlewares/relayer/request.js";

// Router setup
const relayerRouter = Router();

relayerRouter.get("/details", [
  validateDetailsMiddleware,
  relayerDetailsHandler
]);

relayerRouter.post("/request", [
  validateRelayRequestMiddleware,
  relayRequestHandler,
]);

relayerRouter.post("/quote", [
  validateQuoteMiddleware,
  relayQuoteHandler
]);

relayerRouter.post("/batch/request", [
  validateBatchRelayRequestMiddleware,
  batchRelayRequestHandler,
]);

relayerRouter.post("/batch/quote", [
  validateBatchRelayQuoteMiddleware,
  batchRelayQuoteHandler,
]);


export { relayerRouter };
