import cron from 'node-cron';
import { deviceTokenCleanupService } from '../services/deviceTokenCleanupService.js';
import { logger } from '../utils/logger.js';

export function startCleanupCron(): void {
  cron.schedule('0 2 * * 0', async () => {
    logger.info('🧹 Running weekly cleanup...');
    
    try {
      await deviceTokenCleanupService.cleanupInactiveTokens();
      await deviceTokenCleanupService.cleanupOldLogs();
      logger.info('✅ Weekly cleanup completed');
    } catch (error) {
      logger.error('❌ Cleanup cron error:', error);
    }
  });
  
  logger.info('✅ Cleanup cron job started (runs weekly on Sunday at 2 AM)');
}
