import db from '../config/database.js';
import { logger } from '../utils/logger.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

interface UserNotificationPreferences {
  user_id: number;
  notifications_enabled: boolean;
  enable_start_reminders: boolean;
  enable_pre_notification: boolean;
  pre_notification_minutes: number;
  enable_quiet_hours: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  enable_notification_grouping: boolean;
  grouping_window_minutes: number;
  notification_language: string;
}

interface UpdatePreferencesDto {
  notificationsEnabled?: boolean;
  enableStartReminders?: boolean;
  enablePreNotification?: boolean;
  preNotificationMinutes?: number;
  quietHours?: {
    enabled: boolean;
    startTime: string;
    endTime: string;
  };
  grouping?: {
    enabled: boolean;
    windowMinutes: number;
  };
  language?: string;
}

class NotificationPreferencesService {
  async getUserPreferences(userId: number): Promise<UserNotificationPreferences> {
    try {
      const [rows] = await db.query<RowDataPacket[]>(
        'SELECT * FROM user_notification_preferences WHERE user_id = ?',
        [userId]
      );
      
      if (rows.length === 0) {
        return this.getDefaultPreferences(userId);
      }
      
      return rows[0] as UserNotificationPreferences;
    } catch (error) {
      logger.error('❌ Failed to get user preferences:', error);
      return this.getDefaultPreferences(userId);
    }
  }

  private getDefaultPreferences(userId: number): UserNotificationPreferences {
    return {
      user_id: userId,
      notifications_enabled: true,
      enable_start_reminders: true,
      enable_pre_notification: false,
      pre_notification_minutes: 5,
      enable_quiet_hours: false,
      quiet_hours_start: '22:00:00',
      quiet_hours_end: '07:00:00',
      enable_notification_grouping: true,
      grouping_window_minutes: 5,
      notification_language: 'vi',
    };
  }

  async shouldSendNotification(userId: number): Promise<boolean> {
    try {
      const prefs = await this.getUserPreferences(userId);
      
      if (!prefs.notifications_enabled) {
        logger.info(`⏸️ Notifications disabled for user ${userId}`);
        return false;
      }
      
      if (!prefs.enable_start_reminders) {
        logger.info(`⏸️ Start reminders disabled for user ${userId}`);
        return false;
      }
      
      if (prefs.enable_quiet_hours && this.isInQuietHours(prefs)) {
        logger.info(`⏸️ User ${userId} is in quiet hours`);
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error('❌ Error checking if should send notification:', error);
      return true;
    }
  }

  private isInQuietHours(prefs: UserNotificationPreferences): boolean {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    const startParts = prefs.quiet_hours_start.split(':');
    const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
    
    const endParts = prefs.quiet_hours_end.split(':');
    const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
    
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    } else {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
  }

  async updatePreferences(userId: number, updates: UpdatePreferencesDto): Promise<void> {
    try {
      await db.query<ResultSetHeader>(
        `INSERT INTO user_notification_preferences 
         (user_id, notifications_enabled, enable_start_reminders, enable_pre_notification, 
          pre_notification_minutes, enable_quiet_hours, quiet_hours_start, quiet_hours_end,
          enable_notification_grouping, grouping_window_minutes, notification_language)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           notifications_enabled = VALUES(notifications_enabled),
           enable_start_reminders = VALUES(enable_start_reminders),
           enable_pre_notification = VALUES(enable_pre_notification),
           pre_notification_minutes = VALUES(pre_notification_minutes),
           enable_quiet_hours = VALUES(enable_quiet_hours),
           quiet_hours_start = VALUES(quiet_hours_start),
           quiet_hours_end = VALUES(quiet_hours_end),
           enable_notification_grouping = VALUES(enable_notification_grouping),
           grouping_window_minutes = VALUES(grouping_window_minutes),
           notification_language = VALUES(notification_language),
           updated_at = CURRENT_TIMESTAMP`,
        [
          userId,
          updates.notificationsEnabled ?? true,
          updates.enableStartReminders ?? true,
          updates.enablePreNotification ?? false,
          updates.preNotificationMinutes ?? 5,
          updates.quietHours?.enabled ?? false,
          updates.quietHours?.startTime ?? '22:00:00',
          updates.quietHours?.endTime ?? '07:00:00',
          updates.grouping?.enabled ?? true,
          updates.grouping?.windowMinutes ?? 5,
          updates.language ?? 'vi',
        ]
      );
      
      logger.info(`✅ Updated notification preferences for user ${userId}`);
    } catch (error) {
      logger.error('❌ Failed to update preferences:', error);
      throw error;
    }
  }

  async ensureUserPreferences(userId: number): Promise<void> {
    try {
      const [rows] = await db.query<RowDataPacket[]>(
        'SELECT user_id FROM user_notification_preferences WHERE user_id = ?',
        [userId]
      );
      
      if (rows.length === 0) {
        const defaults = this.getDefaultPreferences(userId);
        await db.query<ResultSetHeader>(
          `INSERT INTO user_notification_preferences 
           (user_id, notifications_enabled, enable_start_reminders, enable_pre_notification,
            pre_notification_minutes, enable_quiet_hours, quiet_hours_start, quiet_hours_end,
            enable_notification_grouping, grouping_window_minutes, notification_language)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            defaults.notifications_enabled,
            defaults.enable_start_reminders,
            defaults.enable_pre_notification,
            defaults.pre_notification_minutes,
            defaults.enable_quiet_hours,
            defaults.quiet_hours_start,
            defaults.quiet_hours_end,
            defaults.enable_notification_grouping,
            defaults.grouping_window_minutes,
            defaults.notification_language,
          ]
        );
        logger.info(`✅ Created default preferences for user ${userId}`);
      }
    } catch (error) {
      logger.error('❌ Failed to ensure user preferences:', error);
    }
  }
}

export const notificationPreferencesService = new NotificationPreferencesService();
