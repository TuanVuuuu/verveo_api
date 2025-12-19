import pool from '../config/database.js';
import { UserSubscription, CreateSubscriptionData } from '../models/Subscription.js';
import { AppError } from '../utils/errors.js';
import { ErrorKey, getErrorMessage } from '../constants/errorCatalog.js';

export const createSubscription = async (data: CreateSubscriptionData): Promise<UserSubscription> => {
  const [result] = await pool.execute(
    `INSERT INTO user_subscriptions (
      user_id, revenuecat_user_id, product_id, entitlement_id,
      subscription_status, period_type, purchased_at, expires_at,
      cancelled_at, is_active, platform, store_transaction_id,
      original_transaction_id, raw_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.user_id,
      data.revenuecat_user_id,
      data.product_id,
      data.entitlement_id,
      data.subscription_status,
      data.period_type,
      data.purchased_at || null,
      data.expires_at || null,
      data.cancelled_at || null,
      data.is_active ?? true,
      data.platform,
      data.store_transaction_id || null,
      data.original_transaction_id || null,
      data.raw_data ? JSON.stringify(data.raw_data) : null
    ]
  );

  const subscriptionId = (result as any).insertId;
  return getSubscriptionById(subscriptionId);
};

export const getSubscriptionById = async (id: number): Promise<UserSubscription> => {
  const [rows] = await pool.execute(
    'SELECT * FROM user_subscriptions WHERE id = ?',
    [id]
  );

  const subscriptions = rows as any[];
  if (subscriptions.length === 0) {
    throw new AppError(ErrorKey.TodoNotFound, 'Subscription not found');
  }

  return parseSubscription(subscriptions[0]);
};

export const getActiveSubscriptionByUserId = async (userId: number): Promise<UserSubscription | null> => {
  const [rows] = await pool.execute(
    `SELECT * FROM user_subscriptions 
     WHERE user_id = ? AND is_active = true 
     ORDER BY expires_at DESC 
     LIMIT 1`,
    [userId]
  );

  const subscriptions = rows as any[];
  if (subscriptions.length === 0) {
    return null;
  }

  return parseSubscription(subscriptions[0]);
};

export const getSubscriptionByRevenueCatUserId = async (revenuecatUserId: string): Promise<UserSubscription | null> => {
  const [rows] = await pool.execute(
    `SELECT * FROM user_subscriptions 
     WHERE revenuecat_user_id = ? AND is_active = true 
     ORDER BY expires_at DESC 
     LIMIT 1`,
    [revenuecatUserId]
  );

  const subscriptions = rows as any[];
  if (subscriptions.length === 0) {
    return null;
  }

  return parseSubscription(subscriptions[0]);
};

export const updateSubscription = async (
  id: number,
  updates: Partial<UserSubscription>
): Promise<UserSubscription> => {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.subscription_status !== undefined) {
    fields.push('subscription_status = ?');
    values.push(updates.subscription_status);
  }
  if (updates.expires_at !== undefined) {
    fields.push('expires_at = ?');
    values.push(updates.expires_at);
  }
  if (updates.cancelled_at !== undefined) {
    fields.push('cancelled_at = ?');
    values.push(updates.cancelled_at);
  }
  if (updates.is_active !== undefined) {
    fields.push('is_active = ?');
    values.push(updates.is_active);
  }
  if (updates.raw_data !== undefined) {
    fields.push('raw_data = ?');
    values.push(JSON.stringify(updates.raw_data));
  }

  if (fields.length === 0) {
    return getSubscriptionById(id);
  }

  values.push(id);
  await pool.execute(
    `UPDATE user_subscriptions SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  return getSubscriptionById(id);
};

export const deactivateAllSubscriptionsForUser = async (userId: number): Promise<void> => {
  await pool.execute(
    'UPDATE user_subscriptions SET is_active = false WHERE user_id = ?',
    [userId]
  );
};

export const addSubscriptionHistory = async (
  userId: number,
  subscriptionId: number | null,
  eventType: string,
  eventData: any,
  revenuecatEventId: string | null
): Promise<void> => {
  await pool.execute(
    `INSERT INTO subscription_history 
     (user_id, subscription_id, event_type, event_data, revenuecat_event_id) 
     VALUES (?, ?, ?, ?, ?)`,
    [
      userId,
      subscriptionId,
      eventType,
      JSON.stringify(eventData),
      revenuecatEventId
    ]
  );
};

const parseSubscription = (row: any): UserSubscription => {
  return {
    id: row.id,
    user_id: row.user_id,
    revenuecat_user_id: row.revenuecat_user_id,
    product_id: row.product_id,
    entitlement_id: row.entitlement_id,
    subscription_status: row.subscription_status,
    period_type: row.period_type,
    purchased_at: row.purchased_at ? new Date(row.purchased_at) : null,
    expires_at: row.expires_at ? new Date(row.expires_at) : null,
    cancelled_at: row.cancelled_at ? new Date(row.cancelled_at) : null,
    is_active: Boolean(row.is_active),
    platform: row.platform,
    store_transaction_id: row.store_transaction_id,
    original_transaction_id: row.original_transaction_id,
    raw_data: row.raw_data ? JSON.parse(row.raw_data) : null,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at)
  };
};

