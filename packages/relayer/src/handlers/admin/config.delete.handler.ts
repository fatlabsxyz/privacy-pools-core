import { NextFunction, Response } from "express";
import { ConfigChangeMarshall } from "../../types.js";
import { DeleteConfigRequest } from "../../middlewares/admin/config.middleware.js";
import { relayerConfig } from "../../config/index.js";
import { lastValueFrom } from "rxjs";

/**
 * Handler for the relayer config delete endpoint.
 * Returns Ok if config was deleted.
 * 
 * @param {Request} req - The HTTP request.
 * @param {Response} res - The HTTP response.
 * @param {NextFunction} next - The next middleware function.
 */
export async function configDeleteHandler(
  req: DeleteConfigRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = req.body;

    console.debug(`call to DELETE /config with:`, body);

    const newConfig = await lastValueFrom(relayerConfig.deleteConfig(body));

    // Return details for the specific asset
    res.status(200).json(
      res.locals.marshalResponse(
        new ConfigChangeMarshall(newConfig)
      )
    );

    next();
  } catch (error) {
    console.error('Error in configDeleteHandler:', error);
    next(error);
  }
}
