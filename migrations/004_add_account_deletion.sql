-- Migration: Add account deletion support with 30-day grace period
-- Date: 2025-01-XX
-- Description: Add fields to support soft delete with 30-day grace period

-- Add deletion tracking fields
ALTER TABLE users 
ADD COLUMN deletion_requested_at TIMESTAMP NULL,
ADD COLUMN deletion_scheduled_at TIMESTAMP NULL,
ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;

-- Add index for efficient querying of scheduled deletions
ALTER TABLE users 
ADD INDEX idx_deletion_scheduled (deletion_scheduled_at, is_deleted);

-- Add index for checking deletion status during login
ALTER TABLE users 
ADD INDEX idx_deletion_status (is_deleted, deletion_requested_at);
