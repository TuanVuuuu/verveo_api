-- Migration: Add RevenueCat subscription support
-- Date: 2025-01-XX
-- Description: Add tables to store subscription information from RevenueCat webhooks

-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  revenuecat_user_id VARCHAR(255) NOT NULL,
  product_id VARCHAR(100) NOT NULL,
  entitlement_id VARCHAR(100) NOT NULL,
  subscription_status ENUM(
    'active',
    'expired',
    'cancelled',
    'billing_issue',
    'paused',
    'grace_period',
    'trial'
  ) NOT NULL DEFAULT 'active',
  period_type ENUM('subscription', 'one_time') NOT NULL DEFAULT 'subscription',
  purchased_at TIMESTAMP NULL,
  expires_at TIMESTAMP NULL,
  cancelled_at TIMESTAMP NULL,
  is_active BOOLEAN DEFAULT true,
  platform ENUM('ios', 'android', 'web') NOT NULL,
  store_transaction_id VARCHAR(255) NULL,
  original_transaction_id VARCHAR(255) NULL,
  raw_data JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_revenuecat_user_id (revenuecat_user_id),
  INDEX idx_is_active (is_active),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Create subscription_history table
CREATE TABLE IF NOT EXISTS subscription_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  subscription_id INT NULL,
  event_type VARCHAR(50) NOT NULL,
  event_data JSON NOT NULL,
  revenuecat_event_id VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES user_subscriptions(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_subscription_id (subscription_id),
  INDEX idx_event_type (event_type),
  INDEX idx_created_at (created_at),
  INDEX idx_revenuecat_event_id (revenuecat_event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

