import { Request, Response } from 'express';
import { deviceTokenService } from '../services/deviceTokenService.js';
import { AppError } from '../utils/errors.js';
import { ErrorKey } from '../constants/errorCatalog.js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';

const registerDeviceSchema = z.object({
  deviceId: z.string().min(1),
  fcmToken: z.string().min(1),
  platform: z.enum(['android', 'ios', 'web']),
  appVersion: z.string().optional(),
  osVersion: z.string().optional(),
  deviceModel: z.string().optional(),
});

class FCMController {
  async registerDevice(req: Request, res: Response): Promise<void> {
    try {
      logger.info(`📱 [FCM Register] Received request - Device: ${req.body?.deviceId || 'unknown'}, Platform: ${req.body?.platform || 'unknown'}`);
      
      const validation = registerDeviceSchema.safeParse(req.body);
      if (!validation.success) {
        logger.warn(`⚠️ [FCM Register] Validation failed:`, validation.error.errors);
        throw new AppError(ErrorKey.RequestInvalid);
      }

      const userId = (req as any).user?.userId;
      const hasAuth = !!(req as any).user;
      
      logger.info(`📱 [FCM Register] Valid request - Device: ${validation.data.deviceId}, Platform: ${validation.data.platform}, User: ${userId || 'guest'}, Auth: ${hasAuth ? 'YES' : 'NO'}`);
      
      await deviceTokenService.registerDevice({
        ...validation.data,
        userId,
      });

      logger.info(`✅ [FCM Register] Success - Device: ${validation.data.deviceId}, User: ${userId || 'guest'}`);

      res.json({
        status: 0,
        message: 'success',
        data: {
          deviceId: validation.data.deviceId,
          registered: true,
          mode: userId ? 'logged_in' : 'guest',
        },
      });
    } catch (error) {
      logger.error(`❌ [FCM Register] Failed:`, error);
      throw error;
    }
  }

  async unregisterDevice(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId } = req.body;
      const userId = (req as any).user.userId;
      
      if (!deviceId) {
        throw new AppError(ErrorKey.RequestInvalid);
      }
      
      await deviceTokenService.unregisterDevice(deviceId, userId);

      res.json({
        status: 0,
        message: 'success',
        data: {
          deviceId,
          unregistered: true,
        },
      });
    } catch (error) {
      throw error;
    }
  }

  async updateSettings(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId, isActive } = req.body;
      
      if (!deviceId || typeof isActive !== 'boolean') {
        throw new AppError(ErrorKey.RequestInvalid);
      }
      
      await deviceTokenService.updateSettings(deviceId, isActive);

      res.json({
        status: 0,
        message: 'success',
        data: {
          deviceId,
          isActive,
        },
      });
    } catch (error) {
      throw error;
    }
  }

  async getDevices(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      
      const devices = await deviceTokenService.getDevicesByUserId(userId);

      res.json({
        status: 0,
        message: 'success',
        data: {
          devices,
        },
      });
    } catch (error) {
      throw error;
    }
  }

  async deleteDevice(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId } = req.params;
      const userId = (req as any).user.userId;
      
      await deviceTokenService.deleteDevice(deviceId, userId);

      res.json({
        status: 0,
        message: 'success',
        data: {
          deviceId,
          deleted: true,
        },
      });
    } catch (error) {
      throw error;
    }
  }

  async deleteAllDevices(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      
      await deviceTokenService.deleteAllUserDevices(userId);

      res.json({
        status: 0,
        message: 'success',
        data: {
          message: 'All devices deleted',
        },
      });
    } catch (error) {
      throw error;
    }
  }
}

export const fcmController = new FCMController();
