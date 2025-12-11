import cron from 'node-cron';
import { scheduledNotificationService } from '../services/scheduledNotificationService.js';
import { logger } from '../utils/logger.js';
import { getRedisClient, acquireLock, releaseLock } from '../config/redlock.js';

let isRunning = false;
const LOCK_KEY = 'locks:notification-cron';
const LOCK_TTL = 55000; // 55 seconds (cron runs every 60s)

export function startNotificationCron(): void {
  cron.schedule('* * * * *', async () => {
    const redisClient = getRedisClient();
    let lockValue: string | null = null;
    
    try {
      // Try to acquire distributed lock if Redis is available
      if (redisClient) {
        lockValue = await acquireLock(LOCK_KEY, LOCK_TTL);
        
        if (!lockValue) {
          logger.info('⏸️ Another server is processing notifications, skipping...');
          return;
        }
        
        logger.info('🔒 Acquired distributed lock for cron job');
      } else {
        // Fallback to local lock (single server only)
        if (isRunning) {
          logger.warn('⚠️ Previous cron job still running, skipping...');
          return;
        }
        isRunning = true;
      }
      
      const startTime = Date.now();
      const timestamp = new Date().toISOString();
      
      logger.info(`⏰ [${timestamp}] Running scheduled notification check...`);
      
      await scheduledNotificationService.checkAndSendStartTimeNotifications();
      
      const duration = Date.now() - startTime;
      logger.info(`✅ Cron completed in ${duration}ms`);
      
    } catch (error) {
      logger.error('❌ Cron job error:', error);
    } finally {
      // Release lock
      if (lockValue && redisClient) {
        const released = await releaseLock(LOCK_KEY, lockValue);
        if (released) {
          logger.info('🔓 Released distributed lock');
        } else {
          logger.warn('⚠️ Lock was already released or expired');
        }
      }
      
      if (!redisClient) {
        isRunning = false;
      }
    }
  });
  
  logger.info('✅ Notification cron job started (runs every minute)');
}
