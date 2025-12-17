import cron from 'node-cron';
import { deleteExpiredAccounts } from '../services/accountDeletionService.js';
import { logger } from '../utils/logger.js';
import { getRedisClient, acquireLock, releaseLock } from '../config/redlock.js';

let isRunning = false;
const LOCK_KEY = 'locks:account-deletion-cron';
const LOCK_TTL = 82800000; // 23 hours (cron runs daily)

export function startAccountDeletionCron(): void {
  // Run daily at 2 AM: "0 2 * * *"
  cron.schedule('0 2 * * *', async () => {
    const redisClient = getRedisClient();
    let lockValue: string | null = null;

    try {
      if (redisClient) {
        lockValue = await acquireLock(LOCK_KEY, LOCK_TTL);

        if (!lockValue) {
          logger.info('⏸️ Another server is processing account deletions, skipping...');
          return;
        }

        logger.info('🔒 Acquired distributed lock for account deletion cron job');
      } else {
        if (isRunning) {
          logger.warn('⚠️ Previous account deletion cron job still running, skipping...');
          return;
        }
        isRunning = true;
      }

      const startTime = Date.now();
      const timestamp = new Date().toISOString();

      logger.info(`⏰ [${timestamp}] Running account deletion check...`);

      const deletedCount = await deleteExpiredAccounts();

      const duration = Date.now() - startTime;
      logger.info(`✅ Account deletion cron completed in ${duration}ms, deleted ${deletedCount} account(s)`);
    } catch (error) {
      logger.error('❌ Account deletion cron job error:', error);
    } finally {
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

  logger.info('✅ Account deletion cron job started (runs daily at 2 AM)');
}
