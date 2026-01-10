-- Migration: Add manual plan fields for sandbox testing
-- Date: 2025-01-XX
-- Description: Add fields to users table to allow manual plan setting for testing in sandbox environment

ALTER TABLE users 
ADD COLUMN manual_plan_is_active BOOLEAN DEFAULT false,
ADD COLUMN manual_plan_product_id VARCHAR(100) NULL,
ADD COLUMN manual_plan_entitlement_id VARCHAR(100) NULL,
ADD COLUMN manual_plan_status VARCHAR(50) NULL,
ADD COLUMN manual_plan_expires_at TIMESTAMP NULL;

