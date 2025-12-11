import Queue from 'bull';
import { fcmService } from '../services/fcmService.js';
import { notificationPreferencesService } from '../services/notificationPreferencesService.js';
import { logger } from '../utils/logger.js';

interface NotificationJob {
  userId: number;
  todoId: number;
  notification: {
    title: string;
    body: string;
    data: { [key: string]: string };
  };
}

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

let notificationQueue: Queue.Queue<NotificationJob> | null = null;

export function initializeQueue(): Queue.Queue<NotificationJob> {
  if (notificationQueue) {
    return notificationQueue;
  }

  try {
    notificationQueue = new Queue<NotificationJob>('notifications', {
      redis: redisConfig,
    });

    notificationQueue.process('send-notification', async (job) => {
      const { userId, notification } = job.data;
      
      logger.info(`📤 Processing notification job ${job.id} for user ${userId}`);
      
      try {
        const shouldSend = await notificationPreferencesService.shouldSendNotification(userId);
        
        if (!shouldSend) {
          logger.info(`⏸️ Skipped notification for user ${userId} (user preferences)`);
          return { skipped: true, reason: 'user_preferences' };
        }
        
        await fcmService.sendToUser(userId, notification);
        logger.info(`✅ Notification sent successfully (job ${job.id})`);
        return { sent: true };
      } catch (error) {
        logger.error(`❌ Failed to send notification (job ${job.id}):`, error);
        throw error;
      }
    });

    notificationQueue.on('failed', (job, err) => {
      logger.error(`❌ Job ${job.id} failed after ${job.attemptsMade} attempts:`, err);
    });

    notificationQueue.on('completed', (job) => {
      logger.info(`✅ Job ${job.id} completed`);
    });

    notificationQueue.on('error', (error) => {
      logger.error('❌ Queue error:', error);
    });

    logger.info('✅ Notification queue initialized');
    return notificationQueue;
  } catch (error) {
    logger.error('❌ Failed to initialize notification queue:', error);
    logger.warn('⚠️ Notifications will be sent directly without queue');
    return null as any;
  }
}

export function getQueue(): Queue.Queue<NotificationJob> | null {
  return notificationQueue;
}

export async function closeQueue(): Promise<void> {
  if (notificationQueue) {
    await notificationQueue.close();
    logger.info('✅ Notification queue closed');
  }
}
