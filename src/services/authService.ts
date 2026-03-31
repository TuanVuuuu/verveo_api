import pool from '../config/database.js';
import { hashPassword, comparePassword, generateVerificationToken } from '../utils/crypto.js';
import { generateToken } from '../utils/jwt.js';
import { sendVerificationEmail, sendPasswordResetEmail } from './emailService.js';
import { User, CreateUserData } from '../models/User.js';
import { AppError } from '../utils/errors.js';
import { ErrorKey, getErrorMessage } from '../constants/errorCatalog.js';
import { cancelAccountDeletion } from './accountDeletionService.js';
import { logger } from '../utils/logger.js';
import { isManualPlanActiveForApi } from '../utils/subscriptionEligibility.js';
import { getActiveSubscriptionByUserId } from './subscriptionService.js';

export const registerUser = async (email: string, password: string, name: string) => {
  // Tìm user theo email
  const [existingUsers] = await pool.execute(
    'SELECT * FROM users WHERE email = ?',
    [email]
  );
  
  if ((existingUsers as any[]).length > 0) {
    const existingUser = (existingUsers as any[])[0] as User;

    // ĐÃ có user với email này → KHÔNG auto-link, trả về state cho FE xử lý UX confirm/link
    const existingProviders: string[] = [];
    if (existingUser.password_hash) existingProviders.push('password');
    if (existingUser.google_id) existingProviders.push('google');
    if ((existingUser as any).apple_id) existingProviders.push('apple');

    return {
      state: 'NEED_USER_CONFIRM_LINK',
      context: {
        email,
        existing_providers: existingProviders,
      },
      actions: [
        {
          type: 'REAUTH',
          allowed_methods: existingProviders,
        },
        {
          type: 'CANCEL',
        },
      ],
    };
  }
  
  // Nếu email chưa tồn tại → tạo account mới
  const password_hash = await hashPassword(password);
  const verification_token = generateVerificationToken();
  
  const [result] = await pool.execute(
    'INSERT INTO users (email, password_hash, name, verification_token) VALUES (?, ?, ?, ?)',
    [email, password_hash, name, verification_token]
  );
  
  const userId = (result as any).insertId;
  await sendVerificationEmail(email, verification_token);
  
  return { userId, message: 'User created. Please check your email to verify.' };
};

export const verifyEmail = async (token: string) => {
  const [users] = await pool.execute(
    'SELECT id FROM users WHERE verification_token = ?',
    [token]
  );
  
  if ((users as any[]).length === 0) {
    throw new AppError(ErrorKey.AuthInvalidToken, getErrorMessage(ErrorKey.AuthInvalidToken));
  }
  
  await pool.execute(
    'UPDATE users SET is_verified = true, verification_token = NULL WHERE verification_token = ?',
    [token]
  );
  
  return { message: 'Email verified successfully' };
};

export const loginUser = async (email: string, password: string) => {
  const [users] = await pool.execute(
    'SELECT * FROM users WHERE email = ?',
    [email]
  );
  
  if ((users as any[]).length === 0) {
    throw new AppError(ErrorKey.AuthInvalidCredentials, getErrorMessage(ErrorKey.AuthInvalidCredentials));
  }
  
  const user = (users as any[])[0] as User;

  // Check if account is deleted
  if (user.is_deleted) {
    throw new AppError(ErrorKey.AuthInvalidCredentials, 'Account has been deleted');
  }

  // Chỉ block nếu user HOÀN TOÀN không có password (chỉ có Google)
  // Nếu user có password_hash, cho phép login bằng email/password
  // (ngay cả khi đã link Google account)
  if (user.auth_provider === 'google' && !user.password_hash) {
    throw new AppError(
      ErrorKey.AuthInvalidCredentials,
      'This account was registered with Google. Please use Google Sign-In.'
    );
  }

  if (!user.password_hash) {
    throw new AppError(ErrorKey.AuthInvalidCredentials, getErrorMessage(ErrorKey.AuthInvalidCredentials));
  }
  
  if (!user.is_verified) {
    throw new AppError(ErrorKey.AuthEmailNotVerified, getErrorMessage(ErrorKey.AuthEmailNotVerified));
  }
  
  const isValidPassword = await comparePassword(password, user.password_hash);
  if (!isValidPassword) {
    throw new AppError(ErrorKey.AuthInvalidCredentials, getErrorMessage(ErrorKey.AuthInvalidCredentials));
  }
  
  // Cancel deletion if user has pending deletion request
  if (user.deletion_requested_at) {
    await cancelAccountDeletion(user.id);
    logger.info(`Account deletion cancelled for user ${user.id} due to login`);
  }
  
  const token = generateToken(user.id);
  
  return { token, user: { id: user.id, email: user.email, name: user.name } };
};

export const getUserProfile = async (userId: number) => {
  const [users] = await pool.execute(
    'SELECT id, email, name, password_hash, google_id, apple_id, manual_plan_is_active, manual_plan_product_id, manual_plan_entitlement_id, manual_plan_status, manual_plan_expires_at FROM users WHERE id = ?',
    [userId]
  );
  
  if ((users as any[]).length === 0) {
    throw new AppError(ErrorKey.Unauthorized, getErrorMessage(ErrorKey.Unauthorized));
  }
  
  const user = (users as any[])[0] as User & {
    google_id?: string | null;
    apple_id?: string | null;
    manual_plan_is_active?: boolean | null;
    manual_plan_product_id?: string | null;
    manual_plan_entitlement_id?: string | null;
    manual_plan_status?: string | null;
    manual_plan_expires_at?: Date | null;
  };

  const hasPassword = !!user.password_hash;

  // Lấy subscription từ RevenueCat (nếu có)
  const subscription = await getActiveSubscriptionByUserId(userId);

  // Logic: Ưu tiên subscription từ RevenueCat, nếu không có thì dùng manual plan
  let plan = null;
  
  if (subscription) {
    // Có subscription từ RevenueCat → dùng subscription
    plan = {
      isActive: subscription.is_active,
      productId: subscription.product_id,
      entitlementId: subscription.entitlement_id,
      status: subscription.subscription_status,
      expiresAt: subscription.expires_at?.getTime() || null,
      platform: subscription.platform,
      source: 'revenuecat'
    };
  } else if (isManualPlanActiveForApi(user.manual_plan_is_active, user.manual_plan_expires_at)) {
    plan = {
      isActive: user.manual_plan_is_active,
      productId: user.manual_plan_product_id,
      entitlementId: user.manual_plan_entitlement_id || 'premium',
      status: user.manual_plan_status || 'active',
      expiresAt: user.manual_plan_expires_at?.getTime() || null,
      source: 'manual'
    };
  } else {
    // Không có cả 2 → free plan
    plan = {
      isActive: false,
      productId: null,
      entitlementId: null,
      status: null,
      expiresAt: null,
      source: 'free'
    };
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    signInMethods: {
      password: {
        enabled: hasPassword,
        hasPassword,
      },
      google: !!user.google_id,
      apple: !!(user as any).apple_id,
    },
    plan,
  };
};

export const updateUserProfile = async (
  userId: number, 
  updateData: { 
    name?: string; 
    currentPassword?: string; 
    newPassword?: string;
    plan?: {
      isActive?: boolean;
      productId?: string;
      entitlementId?: string;
      status?: string;
      expiresAt?: number;
    };
  }
) => {
  const [users] = await pool.execute(
    'SELECT * FROM users WHERE id = ?',
    [userId]
  );
  
  if ((users as any[]).length === 0) {
    throw new AppError(ErrorKey.Unauthorized, getErrorMessage(ErrorKey.Unauthorized));
  }
  
  const user = (users as any[])[0] as User;
  
  // If changing password, verify current password
  if (updateData.newPassword && updateData.currentPassword) {
    if (!user.password_hash) {
      throw new AppError(ErrorKey.AuthCurrentPasswordIncorrect, getErrorMessage(ErrorKey.AuthCurrentPasswordIncorrect));
    }
    const isValidPassword = await comparePassword(updateData.currentPassword, user.password_hash);
    if (!isValidPassword) {
      throw new AppError(ErrorKey.AuthCurrentPasswordIncorrect, getErrorMessage(ErrorKey.AuthCurrentPasswordIncorrect));
    }
  }
  
  // Prepare update fields
  const updateFields = [];
  const values = [];
  
  if (updateData.name) {
    updateFields.push('name = ?');
    values.push(updateData.name);
  }
  
  if (updateData.newPassword) {
    const newPasswordHash = await hashPassword(updateData.newPassword);
    updateFields.push('password_hash = ?');
    values.push(newPasswordHash);
  }

  // Update plan (luôn cho phép)
  if (updateData.plan) {
    if (updateData.plan.isActive !== undefined) {
      updateFields.push('manual_plan_is_active = ?');
      values.push(updateData.plan.isActive);
    }
    if (updateData.plan.productId !== undefined) {
      updateFields.push('manual_plan_product_id = ?');
      values.push(updateData.plan.productId);
    }
    if (updateData.plan.entitlementId !== undefined) {
      updateFields.push('manual_plan_entitlement_id = ?');
      values.push(updateData.plan.entitlementId);
    }
    if (updateData.plan.status !== undefined) {
      updateFields.push('manual_plan_status = ?');
      values.push(updateData.plan.status);
    }
    if (updateData.plan.expiresAt !== undefined) {
      updateFields.push('manual_plan_expires_at = ?');
      values.push(updateData.plan.expiresAt ? new Date(updateData.plan.expiresAt) : null);
    }
  }
  
  if (updateFields.length > 0) {
    values.push(userId);
    await pool.execute(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      values
    );
  }
  
  // Return updated user profile (với plan)
  return await getUserProfile(userId);
};

export const forgotPassword = async (email: string) => {
  // Check if user exists
  const [users] = await pool.execute(
    'SELECT id FROM users WHERE email = ? AND is_verified = true',
    [email]
  );
  
  // Always return success message for security (don't reveal if email exists)
  if ((users as any[]).length === 0) {
    return { status: 0, message: 'success', data: { message: 'Password reset email sent if account exists' } };
  }
  
  // Generate reset token
  const resetToken = generateVerificationToken();
  const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
  
  // Store reset token in database
  await pool.execute(
    'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE email = ?',
    [resetToken, resetTokenExpiry, email]
  );
  
  // Send reset email
  await sendPasswordResetEmail(email, resetToken);
  
  return { status: 0, message: 'success', data: { message: 'Password reset email sent if account exists' } };
};

export const resetPassword = async (token: string, newPassword: string) => {
  // Check if token exists and is not expired
  const [users] = await pool.execute(
    'SELECT id FROM users WHERE reset_token = ? AND reset_token_expiry > NOW()',
    [token]
  );
  
  if ((users as any[]).length === 0) {
    throw new AppError(ErrorKey.AuthInvalidToken, getErrorMessage(ErrorKey.AuthInvalidToken));
  }
  
  // Hash new password
  const passwordHash = await hashPassword(newPassword);
  
  // Update password and clear reset token
  await pool.execute(
    'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL WHERE reset_token = ?',
    [passwordHash, token]
  );
  
  return { status: 0, message: 'success', data: { message: 'Password reset successfully' } };
};
