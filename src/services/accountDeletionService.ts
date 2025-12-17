import pool from '../config/database.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';
import { ErrorKey, getErrorMessage } from '../constants/errorCatalog.js';

const DELETION_GRACE_PERIOD_DAYS = 30;
const DELETION_GRACE_PERIOD_MS = DELETION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;

export const requestAccountDeletion = async (userId: number): Promise<void> => {
  const [users] = await pool.execute(
    'SELECT id, is_deleted FROM users WHERE id = ?',
    [userId]
  );

  if ((users as any[]).length === 0) {
    throw new AppError(ErrorKey.Unauthorized, getErrorMessage(ErrorKey.Unauthorized));
  }

  const user = (users as any[])[0] as { id: number; is_deleted: number | boolean };

  if (user.is_deleted) {
    throw new AppError(ErrorKey.Unauthorized, getErrorMessage(ErrorKey.Unauthorized));
  }

  const now = new Date();
  const deletionScheduledAt = new Date(now.getTime() + DELETION_GRACE_PERIOD_MS);

  await pool.execute(
    'UPDATE users SET deletion_requested_at = ?, deletion_scheduled_at = ? WHERE id = ?',
    [now, deletionScheduledAt, userId]
  );

  logger.info(
    `Account deletion requested for user ${userId}, scheduled for ${deletionScheduledAt.toISOString()}`
  );
};

export const cancelAccountDeletion = async (userId: number): Promise<void> => {
  await pool.execute(
    'UPDATE users SET deletion_requested_at = NULL, deletion_scheduled_at = NULL WHERE id = ?',
    [userId]
  );

  logger.info(`Account deletion cancelled for user ${userId}`);
};

export const hasPendingDeletion = async (userId: number): Promise<boolean> => {
  const [users] = await pool.execute(
    'SELECT deletion_requested_at FROM users WHERE id = ? AND deletion_requested_at IS NOT NULL',
    [userId]
  );

  return (users as any[]).length > 0;
};

export const deleteExpiredAccounts = async (): Promise<number> => {
  const now = new Date();

  const [usersToDelete] = await pool.execute(
    `SELECT id, email FROM users 
     WHERE deletion_scheduled_at IS NOT NULL 
     AND deletion_scheduled_at <= ? 
     AND is_deleted = FALSE`,
    [now]
  );

  const users = usersToDelete as any[];

  if (users.length === 0) {
    return 0;
  }

  let deletedCount = 0;

  for (const user of users) {
    try {
      await pool.execute(
        'UPDATE users SET is_deleted = TRUE WHERE id = ?',
        [user.id]
      );

      await pool.execute('DELETE FROM users WHERE id = ?', [user.id]);

      deletedCount++;
      logger.info(`Permanently deleted account ${user.id} (${user.email}) and related data`);
    } catch (error) {
      logger.error(`Failed to delete account ${user.id}:`, error);
    }
  }

  return deletedCount;
}

