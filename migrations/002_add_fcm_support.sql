-- Migration: Add FCM Support
-- Version: 2.1.0
-- Created: 2025-12-09

-- ============================================
-- 1. CREATE device_tokens TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS device_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  
  -- Device & Token Info
  device_id VARCHAR(255) NOT NULL UNIQUE,
  fcm_token VARCHAR(500) NOT NULL,
  platform ENUM('android', 'ios', 'web') NOT NULL,
  
  -- User Association (nullable for Guest Mode)
  user_id INT NULL,
  
  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  app_version VARCHAR(50),
  os_version VARCHAR(50),
  device_model VARCHAR(100),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_user_id (user_id),
  INDEX idx_device_id (device_id),
  INDEX idx_fcm_token (fcm_token(255)),
  INDEX idx_is_active (is_active),
  
  -- Foreign Key
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 2. ADD NOTIFICATION FIELDS TO todos TABLE
-- ============================================
-- Check and add column if not exists
SET @dbname = DATABASE();
SET @tablename = 'todos';
SET @columnname = 'start_notification_sent';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  'ALTER TABLE todos ADD COLUMN start_notification_sent BOOLEAN DEFAULT FALSE AFTER due'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add index if not exists
SET @indexname = 'idx_start_notification';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (index_name = @indexname)
  ) > 0,
  'SELECT 1',
  'CREATE INDEX idx_start_notification ON todos(start_time, start_notification_sent)'
));
PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

-- ============================================
-- 3. CREATE notification_logs TABLE (Optional - for debugging)
-- ============================================
CREATE TABLE IF NOT EXISTS notification_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  device_token_id INT NULL,
  todo_id INT NULL,
  notification_type VARCHAR(50) NOT NULL,
  notification_title VARCHAR(255),
  notification_body TEXT,
  status ENUM('sent', 'delivered', 'failed') DEFAULT 'sent',
  error_message TEXT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_user_id (user_id),
  INDEX idx_todo_id (todo_id),
  INDEX idx_status (status),
  INDEX idx_sent_at (sent_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 4. CREATE user_notification_preferences TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id INT PRIMARY KEY,
  
  -- Global settings
  notifications_enabled BOOLEAN DEFAULT TRUE,
  
  -- Notification types
  enable_start_reminders BOOLEAN DEFAULT TRUE,
  
  -- Pre-notification
  enable_pre_notification BOOLEAN DEFAULT FALSE,
  pre_notification_minutes INT DEFAULT 5,
  
  -- Quiet hours
  enable_quiet_hours BOOLEAN DEFAULT FALSE,
  quiet_hours_start TIME DEFAULT '22:00:00',
  quiet_hours_end TIME DEFAULT '07:00:00',
  
  -- Grouping
  enable_notification_grouping BOOLEAN DEFAULT TRUE,
  grouping_window_minutes INT DEFAULT 5,
  
  -- Language
  notification_language VARCHAR(10) DEFAULT 'vi',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Verify device_tokens table
SELECT 'device_tokens table created' AS status;
SHOW COLUMNS FROM device_tokens;

-- Verify todos table updated
SELECT 'todos table updated' AS status;
SHOW COLUMNS FROM todos WHERE Field = 'start_notification_sent';

-- Verify notification_logs table
SELECT 'notification_logs table created' AS status;
SHOW COLUMNS FROM notification_logs;

-- Verify user_notification_preferences table
SELECT 'user_notification_preferences table created' AS status;
SHOW COLUMNS FROM user_notification_preferences;
