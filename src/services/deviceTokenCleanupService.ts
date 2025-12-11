import db from '../config/database.js';
import { logger } from '../utils/logger.js';
import type { ResultSetHeader } from 'mysql2';

class DeviceTokenCleanupService {
  async cleanupInactiveTokens(): Promise<void> {
    try {
      const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
      
      const [result] = await db.query<ResultSetHeader>(
        `DELETE FROM device_tokens
         WHERE is_active = FALSE
           AND updated_at < FROM_UNIXTIME(? / 1000)
         LIMIT 1000`,
        [ninetyDaysAgo]
      );
      
      logger.info(`✅ Cleaned up ${result.affectedRows} inactive tokens`);
      
    } catch (error) {
      logger.error('❌ Failed to cleanup tokens:', error);
    }
  }
  
  async cleanupOldLogs(): Promise<void> {
    try {
      const [result] = await db.query<ResultSetHeader>(
        `DELETE FROM notification_logs
         WHERE sent_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
         LIMIT 10000`
      );
      
      logger.info(`✅ Cleaned up ${result.affectedRows} old logs`);
      
    } catch (error) {
      logger.error('❌ Failed to cleanup logs:', error);
    }
  }
}

export const deviceTokenCleanupService = new DeviceTokenCleanupService();
