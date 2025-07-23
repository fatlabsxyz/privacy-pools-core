import { Router } from "express";
import {
  relayerDetailsHandler,
  relayQuoteHandler,
  relayRequestHandler,
} from "../handlers/index.js";

// Router setup
const relayerRouter = Router();

relayerRouter.get("/details", [
  relayerDetailsHandler
]);

relayerRouter.post("/request", [
  relayRequestHandler,
]);

relayerRouter.post("/quote", [
  relayQuoteHandler
]);


export { relayerRouter };
