import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { registerUser, verifyEmail, loginUser } from '../services/authService.js';
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

export default router;


