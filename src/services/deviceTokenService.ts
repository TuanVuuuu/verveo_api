import db from '../config/database.js';
import { logger } from '../utils/logger.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

interface RegisterDeviceDto {
  deviceId: string;
  fcmToken: string;
  platform: 'android' | 'ios' | 'web';
  userId?: number;
  appVersion?: string;
  osVersion?: string;
  deviceModel?: string;
}

interface DeviceInfo {
  device_id: string;
  platform: string;
  device_model: string | null;
  is_active: boolean;
  last_active_at: number;
}

class DeviceTokenService {
  async registerDevice(data: RegisterDeviceDto): Promise<void> {
    try {
      const { deviceId, fcmToken, platform, userId, appVersion, osVersion, deviceModel } = data;
      
      await db.query<ResultSetHeader>(
        `INSERT INTO device_tokens 
         (device_id, fcm_token, platform, user_id, app_version, os_version, device_model, last_active_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE
           fcm_token = VALUES(fcm_token),
           user_id = VALUES(user_id),
           platform = VALUES(platform),
           app_version = VALUES(app_version),
           os_version = VALUES(os_version),
           device_model = VALUES(device_model),
           is_active = TRUE,
           last_active_at = CURRENT_TIMESTAMP`,
        [deviceId, fcmToken, platform, userId || null, appVersion, osVersion, deviceModel]
      );
      
      logger.info(`✅ Registered device: ${deviceId} (user: ${userId || 'guest'})`);
    } catch (error) {
      logger.error('❌ Failed to register device:', error);
      throw error;
    }
  }

  async unregisterDevice(deviceId: string, userId: number): Promise<void> {
    try {
      const [result] = await db.query<ResultSetHeader>(
        'DELETE FROM device_tokens WHERE device_id = ? AND user_id = ?',
        [deviceId, userId]
      );
      
      if (result.affectedRows === 0) {
        logger.warn(`⚠️ Device ${deviceId} not found for user ${userId}`);
      } else {
        logger.info(`✅ Unregistered device: ${deviceId} for user ${userId}`);
      }
    } catch (error) {
      logger.error('❌ Failed to unregister device:', error);
      throw error;
    }
  }

  async getDevicesByUserId(userId: number): Promise<DeviceInfo[]> {
    try {
      const [rows] = await db.query<RowDataPacket[]>(
        `SELECT device_id, platform, device_model, is_active, 
                UNIX_TIMESTAMP(last_active_at) * 1000 as last_active_at
         FROM device_tokens 
         WHERE user_id = ? 
         ORDER BY last_active_at DESC`,
        [userId]
      );
      return rows as DeviceInfo[];
    } catch (error) {
      logger.error('❌ Failed to get devices:', error);
      throw error;
    }
  }

  async updateSettings(deviceId: string, isActive: boolean): Promise<void> {
    try {
      await db.query<ResultSetHeader>(
        'UPDATE device_tokens SET is_active = ? WHERE device_id = ?',
        [isActive, deviceId]
      );
      logger.info(`✅ Updated settings for device: ${deviceId} (active: ${isActive})`);
    } catch (error) {
      logger.error('❌ Failed to update settings:', error);
      throw error;
    }
  }

  async deleteDevice(deviceId: string, userId: number): Promise<void> {
    try {
      const [result] = await db.query<ResultSetHeader>(
        'DELETE FROM device_tokens WHERE device_id = ? AND user_id = ?',
        [deviceId, userId]
      );
      
      if (result.affectedRows === 0) {
        throw new Error('Device not found or access denied');
      }
      
      logger.info(`✅ Deleted device: ${deviceId}`);
    } catch (error) {
      logger.error('❌ Failed to delete device:', error);
      throw error;
    }
  }

  async deleteAllUserDevices(userId: number): Promise<void> {
    try {
      await db.query<ResultSetHeader>(
        'DELETE FROM device_tokens WHERE user_id = ?',
        [userId]
      );
      logger.info(`✅ Deleted all devices for user: ${userId}`);
    } catch (error) {
      logger.error('❌ Failed to delete all devices:', error);
      throw error;
    }
  }
}

export const deviceTokenService = new DeviceTokenService();
