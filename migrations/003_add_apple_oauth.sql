-- Migration: Add Apple Sign-In support
-- Date: 2025-01-XX
-- Description: Add apple_id field and update auth_provider enum to support Apple Sign-In

-- Add apple_id column (nullable, unique)
ALTER TABLE users 
ADD COLUMN apple_id VARCHAR(255) NULL UNIQUE,
ADD INDEX idx_apple_id (apple_id);

-- Update auth_provider enum to include 'apple'
ALTER TABLE users 
MODIFY COLUMN auth_provider ENUM('email', 'google', 'apple') DEFAULT 'email';

-- Note: apple_id can coexist with google_id (user can link both accounts)
-- However, Apple does NOT auto-link with Email/Google based on email
