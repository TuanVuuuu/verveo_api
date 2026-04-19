-- Migration: Add App Themes catalog
-- Version: 2.2.0
-- Created: 2026-04-20

-- ============================================
-- 1. CREATE app_theme_catalog_meta TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS app_theme_catalog_meta (
  id TINYINT NOT NULL PRIMARY KEY,
  version VARCHAR(64) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ensure single row exists
INSERT INTO app_theme_catalog_meta (id, version)
VALUES (1, '1970-01-01T00:00:00.000Z')
ON DUPLICATE KEY UPDATE id = id;

-- ============================================
-- 2. CREATE app_themes TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS app_themes (
  id VARCHAR(128) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  calendar_category VARCHAR(64) NOT NULL,
  calendar_category_display VARCHAR(128) NOT NULL,

  payload_json JSON NOT NULL,

  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_is_deleted (is_deleted),
  INDEX idx_category (calendar_category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
SELECT 'app_themes table created' AS status;
SHOW COLUMNS FROM app_themes;
SELECT 'app_theme_catalog_meta table created' AS status;
SHOW COLUMNS FROM app_theme_catalog_meta;

