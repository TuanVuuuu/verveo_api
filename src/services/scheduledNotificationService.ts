import db from '../config/database.js';
import { fcmService } from './fcmService.js';
import { logger } from '../utils/logger.js';
import { getQueue } from '../queues/notificationQueue.js';
import pLimit from 'p-limit';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

interface Todo {
  id: number;
  user_id: number;
  title: string;
  description?: string;
  message?: string;
  start_time?: number;
  due?: number;
}

class ScheduledNotificationService {
  async checkAndSendStartTimeNotifications(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const now = new Date();
      const oneMinuteLater = new Date(Date.now() + 60000);
      
      logger.info(`⏰ Checking for todos between ${now.toISOString()} and ${oneMinuteLater.toISOString()}`);
      
      const [rows] = await db.query<RowDataPacket[]>(
        `SELECT t.id, t.user_id, t.title, t.description, t.message, t.start_time, t.due
         FROM todos t
         WHERE t.start_time IS NOT NULL
           AND t.start_time BETWEEN ? AND ?
           AND t.start_notification_sent = FALSE
         ORDER BY t.start_time ASC
         LIMIT 1000`,
        [now, oneMinuteLater]
      );
      
      const todos = rows as unknown as Todo[];
      
      if (todos.length === 0) {
        logger.info('✅ No todos to notify');
        return;
      }
      
      logger.info(`📋 Found ${todos.length} todos to send notifications`);
      
      const limit = pLimit(10);
      const promises = todos.map(todo =>
        limit(async () => {
          try {
            await this.sendStartNotification(todo);
            
            await db.query<ResultSetHeader>(
              'UPDATE todos SET start_notification_sent = TRUE WHERE id = ?',
              [todo.id]
            );
          } catch (error) {
            logger.error(`❌ Failed to process todo ${todo.id}:`, error);
          }
        })
      );
      
      await Promise.allSettled(promises);
      
      const duration = Date.now() - startTime;
      logger.info(`✅ Processed ${todos.length} todos in ${duration}ms`);
      
    } catch (error) {
      logger.error('❌ Failed to check start time notifications:', error);
    }
  }

  private async sendStartNotification(todo: Todo): Promise<void> {
    try {
      const queue = getQueue();
      
      const notification = {
        title: todo.title || '⏰ Đến giờ làm việc!',
        body: todo.message || todo.description || 'Đến giờ làm việc!',
        data: {
          type: 'todo_start_reminder',
          todoId: todo.id.toString(),
          title: todo.title,
          description: todo.description || '',
          message: todo.message || '',
          startTime: todo.start_time?.toString() || '',
          dueTime: todo.due?.toString() || '',
          timestamp: Date.now().toString(),
        },
      };

      if (queue) {
        await queue.add('send-notification', {
          userId: todo.user_id,
          todoId: todo.id,
          notification,
        }, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          },
          removeOnComplete: true,
          removeOnFail: false,
        });
        
        logger.info(`✅ Queued notification for todo ${todo.id}`);
      } else {
        const devicesCount = await fcmService.sendToUser(todo.user_id, notification);
        if (devicesCount > 0) {
          logger.info(`✅ Sent notification directly to ${devicesCount} device(s) for todo ${todo.id}`);
        } else {
          logger.warn(`⚠️ No active devices found for user ${todo.user_id} (todo ${todo.id})`);
        }
      }
      
      if (process.env.ENABLE_NOTIFICATION_LOGS === 'true') {
        await this.logNotification(todo);
      }
      
    } catch (error) {
      logger.error(`❌ Failed to send start notification for todo ${todo.id}:`, error);
    }
  }

  async resetNotificationFlag(todoId: number, newStartTime?: number): Promise<void> {
    try {
      if (newStartTime !== undefined) {
        await db.query<ResultSetHeader>(
          'UPDATE todos SET start_notification_sent = FALSE WHERE id = ?',
          [todoId]
        );
        logger.info(`🔄 Reset notification flag for todo ${todoId}`);
      }
    } catch (error) {
      logger.error(`❌ Failed to reset notification flag for todo ${todoId}:`, error);
    }
  }

  private async logNotification(todo: Todo): Promise<void> {
    try {
      const notificationTitle = todo.title || '⏰ Đến giờ làm việc!';
      const notificationBody = todo.message || todo.title || todo.description || 'Đến giờ làm việc!';
      
      await db.query<ResultSetHeader>(
        `INSERT INTO notification_logs 
         (user_id, todo_id, notification_type, notification_title, notification_body, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          todo.user_id,
          todo.id,
          'start_reminder',
          notificationTitle,
          notificationBody,
          'sent'
        ]
      );
    } catch (error) {
      logger.error('❌ Failed to log notification:', error);
    }
  }

  async catchUpMissedNotifications(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const now = Date.now();
      const catchupWindowHours = parseInt(process.env.NOTIFICATION_CATCHUP_WINDOW_HOURS || '2');
      const catchupLimit = parseInt(process.env.NOTIFICATION_CATCHUP_LIMIT || '500');
      const windowStart = now - (catchupWindowHours * 60 * 60 * 1000);
      
      logger.info(`🚀 Checking for missed notifications (${new Date(windowStart).toISOString()} - ${new Date(now).toISOString()})`);
      
      const [rows] = await db.query<RowDataPacket[]>(
        `SELECT t.id, t.user_id, t.title, t.description, t.message, t.start_time
         FROM todos t
         WHERE t.start_time IS NOT NULL
           AND t.start_time BETWEEN ? AND ?
           AND t.start_notification_sent = FALSE
         ORDER BY t.start_time ASC
         LIMIT ?`,
        [windowStart, now, catchupLimit]
      );
      
      const todos = rows as unknown as Todo[];
      
      if (todos.length === 0) {
        logger.info('✅ No missed notifications found');
        return;
      }
      
      logger.warn(`⚠️ Found ${todos.length} missed notifications, processing...`);
      
      const limit = pLimit(5);
      const promises = todos.map(todo =>
        limit(async () => {
          try {
            await this.sendLateNotification(todo);
            
            await db.query<ResultSetHeader>(
              'UPDATE todos SET start_notification_sent = TRUE WHERE id = ?',
              [todo.id]
            );
          } catch (error) {
            logger.error(`❌ Failed to process late notification for todo ${todo.id}:`, error);
          }
        })
      );
      
      await Promise.allSettled(promises);
      
      const duration = Date.now() - startTime;
      logger.info(`✅ Catch-up complete: Processed ${todos.length} missed notifications in ${duration}ms`);
      
    } catch (error) {
      logger.error('❌ Failed to catch up missed notifications:', error);
    }
  }

  private async sendLateNotification(todo: Todo): Promise<void> {
    try {
      const queue = getQueue();
      const timeStr = todo.start_time 
        ? new Date(todo.start_time).toLocaleTimeString('vi-VN')
        : 'không xác định';

      const notification = {
        title: todo.title || '⏰ Nhắc nhở (đã trễ)',
        body: todo.message || `${todo.title} - Bắt đầu lúc ${timeStr}`,
        data: {
          type: 'todo_start_reminder_late',
          todoId: todo.id.toString(),
          title: todo.title,
          description: todo.description || '',
          message: todo.message || '',
          startTime: todo.start_time?.toString() || '',
          timestamp: Date.now().toString(),
          late: 'true',
        },
      };

      if (queue) {
        await queue.add('send-notification', {
          userId: todo.user_id,
          todoId: todo.id,
          notification,
        }, {
          priority: 2,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          },
        });
        logger.info(`✅ Queued late notification for todo ${todo.id}`);
      } else {
        const devicesCount = await fcmService.sendToUser(todo.user_id, notification);
        if (devicesCount > 0) {
          logger.info(`✅ Sent late notification directly to ${devicesCount} device(s) for todo ${todo.id}`);
        } else {
          logger.warn(`⚠️ No active devices found for user ${todo.user_id} (late todo ${todo.id})`);
        }
      }
      
    } catch (error) {
      logger.error(`❌ Failed to send late notification for todo ${todo.id}:`, error);
    }
  }
}

export const scheduledNotificationService = new ScheduledNotificationService();
