import { Request, Response, NextFunction } from 'express';
import { processWebhookEvent } from '../services/revenuecatService.js';
import { RevenueCatWebhookEvent } from '../models/Subscription.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';
import { ErrorKey, getErrorMessage } from '../constants/errorCatalog.js';

export const handleWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const event = req.body as RevenueCatWebhookEvent;

    if (!event || !event.event) {
      return next(new AppError(ErrorKey.RequestInvalid, 'Invalid webhook payload'));
    }

    processWebhookEvent(event).catch((error) => {
      logger.error('Error processing RevenueCat webhook:', error);
    });

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Error handling RevenueCat webhook:', error);
    next(error);
  }
};

