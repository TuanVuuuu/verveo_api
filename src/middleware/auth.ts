import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import { AppError } from '../utils/errors.js';
import { ErrorKey, getErrorMessage } from '../constants/errorCatalog.js';

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return next(new AppError(ErrorKey.Unauthorized, getErrorMessage(ErrorKey.Unauthorized)));
  }
  
  try {
    const decoded = verifyToken(token);
    (req as any).user = decoded;
    next();
  } catch (error) {
    // Check if it's a JWT expiration error
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      return next(new AppError(ErrorKey.AuthTokenExpired, getErrorMessage(ErrorKey.AuthTokenExpired)));
    }
    // Check if it's a JWT malformed error
    if (error instanceof Error && (error.name === 'JsonWebTokenError' || error.name === 'NotBeforeError')) {
      return next(new AppError(ErrorKey.AuthInvalidToken, getErrorMessage(ErrorKey.AuthInvalidToken)));
    }
    // Other JWT errors
    return next(new AppError(ErrorKey.Unauthorized, getErrorMessage(ErrorKey.Unauthorized)));
  }
};
