-- Migration: Add Google OAuth support
-- Date: 2025-01-XX
-- Description: Add google_id and auth_provider fields to users table for Google Sign-In support

-- Add google_id column (nullable, unique)
ALTER TABLE users 
ADD COLUMN google_id VARCHAR(255) NULL UNIQUE,
ADD INDEX idx_google_id (google_id);

-- Add auth_provider column (enum: 'email' or 'google', default 'email')
ALTER TABLE users 
ADD COLUMN auth_provider ENUM('email', 'google') DEFAULT 'email';

-- Make password_hash nullable (Google users don't have passwords)
ALTER TABLE users 
MODIFY COLUMN password_hash VARCHAR(255) NULL;

-- Update existing users to have auth_provider = 'email'
UPDATE users SET auth_provider = 'email' WHERE auth_provider IS NULL;

