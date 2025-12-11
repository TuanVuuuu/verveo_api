import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger.js';

let redisClient: RedisClientType | null = null;

export async function initializeRedisLock(): Promise<RedisClientType | null> {
  if (redisClient) {
    return redisClient;
  }

  try {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379');

    redisClient = createClient({
      socket: {
        host: redisHost,
        port: redisPort,
      },
    });

    redisClient.on('error', (err: Error) => {
      logger.error('Redis Client Error:', err);
    });

    await redisClient.connect();
    
    // Test Redis connection
    await redisClient.ping();
    logger.info('✅ Redis client connected and ready for distributed locks');

    return redisClient;
  } catch (error) {
    logger.error('❌ Failed to initialize Redis client:', error);
    logger.warn('⚠️ Cron will use local lock only (not suitable for multi-server)');
    return null;
  }
}

export function getRedisClient(): RedisClientType | null {
  return redisClient;
}

/**
 * Acquire a distributed lock using Redis SET NX EX
 * @param lockKey - The lock key
 * @param ttlMs - TTL in milliseconds
 * @returns Lock value (UUID) if acquired, null otherwise
 */
export async function acquireLock(lockKey: string, ttlMs: number): Promise<string | null> {
  if (!redisClient) {
    return null;
  }

  try {
    const lockValue = `lock-${Date.now()}-${Math.random()}`;
    const ttlSeconds = Math.ceil(ttlMs / 1000);
    
    // SET key value NX EX ttl
    const result = await redisClient.set(lockKey, lockValue, {
      NX: true, // Only set if not exists
      EX: ttlSeconds, // Expire after ttl seconds
    });

    if (result === 'OK') {
      return lockValue;
    }
    return null;
  } catch (error) {
    logger.error('❌ Failed to acquire lock:', error);
    return null;
  }
}

/**
 * Release a distributed lock
 * @param lockKey - The lock key
 * @param lockValue - The lock value to verify ownership
 */
export async function releaseLock(lockKey: string, lockValue: string): Promise<boolean> {
  if (!redisClient) {
    return false;
  }

  try {
    // Only delete if the value matches (to avoid releasing someone else's lock)
    const currentValue = await redisClient.get(lockKey);
    if (currentValue === lockValue) {
      await redisClient.del(lockKey);
      return true;
    }
    return false;
  } catch (error) {
    logger.error('❌ Failed to release lock:', error);
    return false;
  }
}

export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    logger.info('✅ Redis connection closed');
  }
}
