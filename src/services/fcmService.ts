import admin from 'firebase-admin';
import db from '../config/database.js';
import { logger } from '../utils/logger.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

interface NotificationPayload {
  title: string;
  body: string;
  data?: { [key: string]: string };
}

class FCMService {
  private static instance: FCMService;
  private initialized = false;

  private constructor() {}

  static getInstance(): FCMService {
    if (!FCMService.instance) {
      FCMService.instance = new FCMService();
    }
    return FCMService.instance;
  }

  initializeFirebase(): void {
    if (this.initialized) {
      return;
    }

    try {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;
      const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

      if (!projectId || !clientEmail || !privateKey) {
        logger.warn('⚠️ Firebase credentials not configured. FCM notifications disabled.');
        return;
      }

      // Check if already initialized
      const apps = admin.apps || [];
      if (apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
          ...(storageBucket ? { storageBucket } : {}),
        });
      }
      
      logger.info('✅ Firebase Admin SDK initialized successfully');
      this.initialized = true;
    } catch (error) {
      logger.error('❌ Failed to initialize Firebase Admin SDK:', error);
      throw error;
    }
  }

  async sendToDevice(fcmToken: string, notification: NotificationPayload): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('Firebase Admin SDK not initialized. Please configure Firebase credentials.');
    }

    try {
      const message = {
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data || {},
        token: fcmToken,
        android: {
          priority: 'high' as const,
          notification: {
            sound: 'default',
            channelId: 'todo_reminders',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      await admin.messaging().send(message);
      logger.info(`✅ Notification sent to ${fcmToken.substring(0, 20)}...`);
      return true;
    } catch (error: any) {
      logger.error(`❌ Failed to send notification: ${error.message}`);
      
      if (error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered') {
        await this.handleInvalidToken(fcmToken);
      }
      
      return false;
    }
  }

  async sendToDevices(fcmTokens: string[], notification: NotificationPayload): Promise<void> {
    if (fcmTokens.length === 0) {
      logger.warn('⚠️ No FCM tokens to send to');
      return;
    }

    logger.info(`📤 Sending notification to ${fcmTokens.length} devices`);
    
    const promises = fcmTokens.map(token => this.sendToDevice(token, notification));
    const results = await Promise.allSettled(promises);
    
    const succeeded = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
    const failed = results.length - succeeded;
    
    logger.info(`📊 Notification results: ${succeeded} succeeded, ${failed} failed`);
  }

  async sendToUser(userId: number, notification: NotificationPayload): Promise<number> {
    try {
      const [rows] = await db.query<RowDataPacket[]>(
        'SELECT fcm_token FROM device_tokens WHERE user_id = ? AND is_active = TRUE',
        [userId]
      );
      
      const tokens = rows.map(row => row.fcm_token as string);
      
      if (tokens.length > 0) {
        await this.sendToDevices(tokens, notification);
        logger.info(`✅ Sent notification to ${tokens.length} devices of user ${userId}`);
        return tokens.length;
      } else {
        logger.warn(`⚠️ No active devices found for user ${userId}`);
        return 0;
      }
    } catch (error) {
      logger.error(`❌ Failed to send notification to user ${userId}:`, error);
      throw error;
    }
  }

  private async handleInvalidToken(fcmToken: string): Promise<void> {
    try {
      await db.query<ResultSetHeader>(
        'UPDATE device_tokens SET is_active = FALSE WHERE fcm_token = ?',
        [fcmToken]
      );
      logger.info(`🔒 Deactivated invalid FCM token`);
    } catch (error) {
      logger.error('❌ Failed to deactivate invalid token:', error);
    }
  }
}

export const fcmService = FCMService.getInstance();
