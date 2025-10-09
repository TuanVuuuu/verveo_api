import pool from '../config/database.js';
import { hashPassword, comparePassword, generateVerificationToken } from '../utils/crypto.js';
import { generateToken } from '../utils/jwt.js';
import { sendVerificationEmail } from './emailService.js';
import { User, CreateUserData } from '../models/User.js';
import { AppError } from '../utils/errors.js';
import { ErrorKey, getErrorMessage } from '../constants/errorCatalog.js';

export const registerUser = async (email: string, password: string, name: string) => {
  // Check if user exists
  const [existingUsers] = await pool.execute(
    'SELECT id FROM users WHERE email = ?',
    [email]
  );
  
  if ((existingUsers as any[]).length > 0) {
    throw new AppError(ErrorKey.AuthUserExists, getErrorMessage(ErrorKey.AuthUserExists));
  }
  
  // Hash password and generate token
  const password_hash = await hashPassword(password);
  const verification_token = generateVerificationToken();
  
  // Create user
  const [result] = await pool.execute(
    'INSERT INTO users (email, password_hash, name, verification_token) VALUES (?, ?, ?, ?)',
    [email, password_hash, name, verification_token]
  );
  
  const userId = (result as any).insertId;
  
  // Send verification email
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
  
  if (!user.is_verified) {
    throw new AppError(ErrorKey.AuthEmailNotVerified, getErrorMessage(ErrorKey.AuthEmailNotVerified));
  }
  
  const isValidPassword = await comparePassword(password, user.password_hash);
  if (!isValidPassword) {
    throw new AppError(ErrorKey.AuthInvalidCredentials, getErrorMessage(ErrorKey.AuthInvalidCredentials));
  }
  
  const token = generateToken(user.id);
  
  return { token, user: { id: user.id, email: user.email, name: user.name } };
};

export const getUserProfile = async (userId: number) => {
  const [users] = await pool.execute(
    'SELECT id, email, name FROM users WHERE id = ?',
    [userId]
  );
  
  if ((users as any[]).length === 0) {
    throw new AppError(ErrorKey.Unauthorized, getErrorMessage(ErrorKey.Unauthorized));
  }
  
  const user = (users as any[])[0];
  return { id: user.id, email: user.email, name: user.name };
};

export const updateUserProfile = async (userId: number, updateData: { name?: string; currentPassword?: string; newPassword?: string }) => {
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
    const isValidPassword = await comparePassword(updateData.currentPassword, user.password_hash);
    if (!isValidPassword) {
      throw new AppError(ErrorKey.AuthInvalidCredentials, getErrorMessage(ErrorKey.AuthInvalidCredentials));
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
  
  if (updateFields.length > 0) {
    values.push(userId);
    await pool.execute(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      values
    );
  }
  
  // Return updated user profile
  const [updatedUsers] = await pool.execute(
    'SELECT id, email, name FROM users WHERE id = ?',
    [userId]
  );
  
  const updatedUser = (updatedUsers as any[])[0];
  return { id: updatedUser.id, email: updatedUser.email, name: updatedUser.name };
};
