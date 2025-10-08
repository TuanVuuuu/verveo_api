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
