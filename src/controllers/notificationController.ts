import { Request, Response } from 'express';
import { notificationPreferencesService } from '../services/notificationPreferencesService.js';
import { z } from 'zod';
import { AppError } from '../utils/errors.js';
import { ErrorKey } from '../constants/errorCatalog.js';

const updatePreferencesSchema = z.object({
  notificationsEnabled: z.boolean().optional(),
  enableStartReminders: z.boolean().optional(),
  enablePreNotification: z.boolean().optional(),
  preNotificationMinutes: z.number().min(1).max(60).optional(),
  quietHours: z.object({
    enabled: z.boolean(),
    startTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
  }).optional(),
  grouping: z.object({
    enabled: z.boolean(),
    windowMinutes: z.number().min(1).max(30),
  }).optional(),
  language: z.enum(['vi', 'en']).optional(),
});

class NotificationController {
  async getPreferences(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      
      const preferences = await notificationPreferencesService.getUserPreferences(userId);

      res.json({
        status: 0,
        message: 'success',
        data: {
          notificationsEnabled: preferences.notifications_enabled,
          enableStartReminders: preferences.enable_start_reminders,
          enablePreNotification: preferences.enable_pre_notification,
          preNotificationMinutes: preferences.pre_notification_minutes,
          quietHours: {
            enabled: preferences.enable_quiet_hours,
            startTime: preferences.quiet_hours_start,
            endTime: preferences.quiet_hours_end,
          },
          grouping: {
            enabled: preferences.enable_notification_grouping,
            windowMinutes: preferences.grouping_window_minutes,
          },
          language: preferences.notification_language,
        },
      });
    } catch (error) {
      throw error;
    }
  }

  async updatePreferences(req: Request, res: Response): Promise<void> {
    try {
      const validation = updatePreferencesSchema.safeParse(req.body);
      if (!validation.success) {
        throw new AppError(ErrorKey.RequestInvalid);
      }

      const userId = (req as any).user.userId;
      
      await notificationPreferencesService.updatePreferences(userId, validation.data);

      res.json({
        status: 0,
        message: 'success',
        data: {
          message: 'Preferences updated successfully',
        },
      });
    } catch (error) {
      throw error;
    }
  }
}

export const notificationController = new NotificationController();
