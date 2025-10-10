import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { registerUser, verifyEmail, loginUser, getUserProfile, updateUserProfile, forgotPassword, resetPassword } from '../services/authService.js';
import { authenticateToken } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';
import { ErrorKey, getErrorMessage } from '../constants/errorCatalog.js';

const router = express.Router();

const RegisterRequest = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1)
});

const LoginRequest = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const UpdateProfileRequest = z.object({
  name: z.string().min(1).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).optional()
}).refine((data) => {
  // If newPassword is provided, currentPassword is required
  if (data.newPassword && !data.currentPassword) {
    return false;
  }
  return true;
});

const ForgotPasswordRequest = z.object({
  email: z.string().email()
});

const ResetPasswordRequest = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(6)
});

router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parse = RegisterRequest.safeParse(req.body);
    if (!parse.success) {
      return next(new AppError(ErrorKey.RequestInvalid, getErrorMessage(ErrorKey.RequestInvalid)));
    }
    const { email, password, name } = parse.data;
    const result = await registerUser(email, password, name);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return next(new AppError(ErrorKey.RequestInvalid, getErrorMessage(ErrorKey.RequestInvalid)));
    }
    const result = await verifyEmail(token);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parse = LoginRequest.safeParse(req.body);
    if (!parse.success) {
      return next(new AppError(ErrorKey.RequestInvalid, getErrorMessage(ErrorKey.RequestInvalid)));
    }
    const { email, password } = parse.data;
    const result = await loginUser(email, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /auth/me - Get current user profile
router.get('/me', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId;
    const result = await getUserProfile(userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /auth/profile - Update user profile
router.put('/profile', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parse = UpdateProfileRequest.safeParse(req.body);
    if (!parse.success) {
      return next(new AppError(ErrorKey.RequestInvalid, getErrorMessage(ErrorKey.RequestInvalid)));
    }
    const userId = (req as any).user.userId;
    const result = await updateUserProfile(userId, parse.data);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /auth/forgot-password - Request password reset
router.post('/forgot-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parse = ForgotPasswordRequest.safeParse(req.body);
    if (!parse.success) {
      return next(new AppError(ErrorKey.RequestInvalid, getErrorMessage(ErrorKey.RequestInvalid)));
    }
    const { email } = parse.data;
    const result = await forgotPassword(email);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /auth/reset-password - Reset password with token
router.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parse = ResetPasswordRequest.safeParse(req.body);
    if (!parse.success) {
      return next(new AppError(ErrorKey.RequestInvalid, getErrorMessage(ErrorKey.RequestInvalid)));
    }
    const { token, newPassword } = parse.data;
    const result = await resetPassword(token, newPassword);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;


