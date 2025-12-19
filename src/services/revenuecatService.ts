import crypto from 'crypto';
import { RevenueCatWebhookEvent } from '../models/Subscription.js';
import {
  createSubscription,
  getSubscriptionByRevenueCatUserId,
  updateSubscription,
  deactivateAllSubscriptionsForUser,
  addSubscriptionHistory
} from './subscriptionService.js';
import pool from '../config/database.js';
import { logger } from '../utils/logger.js';

const REVENUECAT_WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET || '';

export const verifyWebhookSignature = (payload: string, signature: string): boolean => {
  if (!REVENUECAT_WEBHOOK_SECRET) {
    logger.warn('REVENUECAT_WEBHOOK_SECRET not configured');
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', REVENUECAT_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};

const getUserByRevenueCatUserId = async (revenuecatUserId: string): Promise<number | null> => {
  const userId = parseInt(revenuecatUserId, 10);
  if (isNaN(userId)) {
    return null;
  }

  const [users] = await pool.execute(
    'SELECT id FROM users WHERE id = ? AND is_deleted = false',
    [userId]
  );

  const userRows = users as any[];
  if (userRows.length === 0) {
    return null;
  }

  return userRows[0].id;
};

const mapStoreToPlatform = (store: string): 'ios' | 'android' | 'web' => {
  if (store === 'APP_STORE') return 'ios';
  if (store === 'PLAY_STORE') return 'android';
  return 'web';
};

const mapStatusFromEvent = (eventType: string, expiresAt: number | null): string => {
  if (eventType === 'EXPIRATION') return 'expired';
  if (eventType === 'CANCELLATION') return 'cancelled';
  if (eventType === 'BILLING_ISSUE') return 'billing_issue';
  if (eventType === 'SUBSCRIPTION_PAUSED') return 'paused';
  return 'active';
};

export const processWebhookEvent = async (event: RevenueCatWebhookEvent): Promise<void> => {
  const { event: eventData } = event;
  const userId = await getUserByRevenueCatUserId(eventData.app_user_id);

  if (!userId) {
    logger.warn(`User not found for RevenueCat user ID: ${eventData.app_user_id}`);
    return;
  }

  await addSubscriptionHistory(
    userId,
    null,
    eventData.type,
    event,
    eventData.id
  );

  switch (eventData.type) {
    case 'INITIAL_PURCHASE':
      await handleInitialPurchase(userId, eventData, event);
      break;
    case 'RENEWAL':
      await handleRenewal(userId, eventData, event);
      break;
    case 'CANCELLATION':
      await handleCancellation(userId, eventData, event);
      break;
    case 'UNCANCELLATION':
      await handleUncancellation(userId, eventData, event);
      break;
    case 'EXPIRATION':
      await handleExpiration(userId, eventData, event);
      break;
    case 'BILLING_ISSUE':
      await handleBillingIssue(userId, eventData, event);
      break;
    case 'PRODUCT_CHANGE':
      await handleProductChange(userId, eventData, event);
      break;
    case 'SUBSCRIPTION_PAUSED':
      await handleSubscriptionPaused(userId, eventData, event);
      break;
    default:
      logger.warn(`Unknown event type: ${eventData.type}`);
  }
};

const handleInitialPurchase = async (
  userId: number,
  eventData: any,
  fullEvent: RevenueCatWebhookEvent
) => {
  await deactivateAllSubscriptionsForUser(userId);

  const entitlementId = eventData.entitlement_ids?.[0] || 'premium';
  const purchasedAt = eventData.purchased_at_ms ? new Date(eventData.purchased_at_ms) : new Date();
  const expiresAt = eventData.expires_at_ms ? new Date(eventData.expires_at_ms) : null;

  await createSubscription({
    user_id: userId,
    revenuecat_user_id: eventData.app_user_id,
    product_id: eventData.product_id,
    entitlement_id: entitlementId,
    subscription_status: 'active',
    period_type: eventData.period_type,
    purchased_at: purchasedAt,
    expires_at: expiresAt,
    is_active: true,
    platform: mapStoreToPlatform(eventData.store),
    store_transaction_id: eventData.transaction_id,
    original_transaction_id: eventData.original_transaction_id,
    raw_data: fullEvent
  });

  logger.info(`Initial purchase processed for user ${userId}, product ${eventData.product_id}`);
};

const handleRenewal = async (
  userId: number,
  eventData: any,
  fullEvent: RevenueCatWebhookEvent
) => {
  const existing = await getSubscriptionByRevenueCatUserId(eventData.app_user_id);
  if (!existing) {
    logger.warn(`No subscription found for renewal, user ${userId}`);
    return;
  }

  const expiresAt = eventData.expires_at_ms ? new Date(eventData.expires_at_ms) : null;
  await updateSubscription(existing.id, {
    subscription_status: 'active',
    expires_at: expiresAt,
    cancelled_at: null,
    is_active: true,
    raw_data: fullEvent
  });

  logger.info(`Renewal processed for user ${userId}, subscription ${existing.id}`);
};

const handleCancellation = async (
  userId: number,
  eventData: any,
  fullEvent: RevenueCatWebhookEvent
) => {
  const existing = await getSubscriptionByRevenueCatUserId(eventData.app_user_id);
  if (!existing) {
    logger.warn(`No subscription found for cancellation, user ${userId}`);
    return;
  }

  await updateSubscription(existing.id, {
    subscription_status: 'cancelled',
    cancelled_at: new Date(),
    raw_data: fullEvent
  });

  logger.info(`Cancellation processed for user ${userId}, subscription ${existing.id}`);
};

const handleUncancellation = async (
  userId: number,
  eventData: any,
  fullEvent: RevenueCatWebhookEvent
) => {
  const existing = await getSubscriptionByRevenueCatUserId(eventData.app_user_id);
  if (!existing) {
    logger.warn(`No subscription found for uncancellation, user ${userId}`);
    return;
  }

  await updateSubscription(existing.id, {
    subscription_status: 'active',
    cancelled_at: null,
    raw_data: fullEvent
  });

  logger.info(`Uncancellation processed for user ${userId}, subscription ${existing.id}`);
};

const handleExpiration = async (
  userId: number,
  eventData: any,
  fullEvent: RevenueCatWebhookEvent
) => {
  const existing = await getSubscriptionByRevenueCatUserId(eventData.app_user_id);
  if (!existing) {
    logger.warn(`No subscription found for expiration, user ${userId}`);
    return;
  }

  await updateSubscription(existing.id, {
    subscription_status: 'expired',
    is_active: false,
    raw_data: fullEvent
  });

  logger.info(`Expiration processed for user ${userId}, subscription ${existing.id}`);
};

const handleBillingIssue = async (
  userId: number,
  eventData: any,
  fullEvent: RevenueCatWebhookEvent
) => {
  const existing = await getSubscriptionByRevenueCatUserId(eventData.app_user_id);
  if (!existing) {
    logger.warn(`No subscription found for billing issue, user ${userId}`);
    return;
  }

  await updateSubscription(existing.id, {
    subscription_status: 'billing_issue',
    raw_data: fullEvent
  });

  logger.info(`Billing issue processed for user ${userId}, subscription ${existing.id}`);
};

const handleProductChange = async (
  userId: number,
  eventData: any,
  fullEvent: RevenueCatWebhookEvent
) => {
  await deactivateAllSubscriptionsForUser(userId);

  const entitlementId = eventData.entitlement_ids?.[0] || 'premium';
  const purchasedAt = eventData.purchased_at_ms ? new Date(eventData.purchased_at_ms) : new Date();
  const expiresAt = eventData.expires_at_ms ? new Date(eventData.expires_at_ms) : null;

  await createSubscription({
    user_id: userId,
    revenuecat_user_id: eventData.app_user_id,
    product_id: eventData.product_id,
    entitlement_id: entitlementId,
    subscription_status: 'active',
    period_type: eventData.period_type,
    purchased_at: purchasedAt,
    expires_at: expiresAt,
    is_active: true,
    platform: mapStoreToPlatform(eventData.store),
    store_transaction_id: eventData.transaction_id,
    original_transaction_id: eventData.original_transaction_id,
    raw_data: fullEvent
  });

  logger.info(`Product change processed for user ${userId}, new product ${eventData.product_id}`);
};

const handleSubscriptionPaused = async (
  userId: number,
  eventData: any,
  fullEvent: RevenueCatWebhookEvent
) => {
  const existing = await getSubscriptionByRevenueCatUserId(eventData.app_user_id);
  if (!existing) {
    logger.warn(`No subscription found for pause, user ${userId}`);
    return;
  }

  await updateSubscription(existing.id, {
    subscription_status: 'paused',
    raw_data: fullEvent
  });

  logger.info(`Subscription paused for user ${userId}, subscription ${existing.id}`);
};

