import { Request, Response, NextFunction } from 'express';
import { verifyWebhookSignature } from '../services/revenuecatService.js';
import { AppError } from '../utils/errors.js';
import { ErrorKey, getErrorMessage } from '../constants/errorCatalog.js';
import { logger } from '../utils/logger.js';

export const verifyRevenueCatWebhook = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const payload = JSON.stringify(req.body);
  
  // RevenueCat có thể gửi signature trong header 'authorization' hoặc 'x-webhook-signature'
  const signature = 
    (req.headers['authorization'] as string) || 
    (req.headers['x-webhook-signature'] as string) ||
    (req.headers['x-revenuecat-signature'] as string);

  // If Webhook Secret is configured, verify signature
  if (process.env.REVENUECAT_WEBHOOK_SECRET) {
    if (!signature) {
      logger.warn('RevenueCat webhook missing signature header');
      return next(new AppError(ErrorKey.Unauthorized, 'Missing signature header'));
    }

    const isValid = verifyWebhookSignature(payload, signature);
    if (!isValid) {
      logger.warn('RevenueCat webhook invalid signature');
      return next(new AppError(ErrorKey.Unauthorized, 'Invalid webhook signature'));
    }
  } else {
    // No secret configured - log for debugging (FOR TESTING ONLY)
    logger.warn('⚠️ REVENUECAT_WEBHOOK_SECRET not configured - allowing webhook without verification (FOR TESTING ONLY)');
    logger.info('Webhook received - headers:', Object.keys(req.headers));
    logger.info('Webhook signature header:', {
      'authorization': req.headers['authorization'],
      'x-webhook-signature': req.headers['x-webhook-signature'],
      'x-revenuecat-signature': req.headers['x-revenuecat-signature']
    });
  }

  next();
};

