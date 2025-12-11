import { Request, Response } from 'express';
import { deviceTokenService } from '../services/deviceTokenService.js';
import { AppError } from '../utils/errors.js';
import { ErrorKey } from '../constants/errorCatalog.js';
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
      const validation = registerDeviceSchema.safeParse(req.body);
      if (!validation.success) {
        throw new AppError(ErrorKey.RequestInvalid);
      }

      const userId = (req as any).user?.userId;
      
      await deviceTokenService.registerDevice({
        ...validation.data,
        userId,
      });

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
