import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';
import { ErrorKey, getErrorMessage } from '../constants/errorCatalog.js';

const parseIdSet = (raw?: string): Set<number> => {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Number(s))
      .filter((n) => Number.isInteger(n) && n > 0)
  );
};

export const requireAdminOrService = (req: Request, _res: Response, next: NextFunction) => {
  const serviceToken = (req.headers['x-service-token'] as string | undefined) || undefined;
  const expectedServiceToken = process.env.SERVICE_ROLE_TOKEN;
  if (expectedServiceToken && serviceToken && serviceToken === expectedServiceToken) {
    return next();
  }

  const userId = Number((req as any).user?.userId);
  const adminIds = parseIdSet(process.env.ADMIN_USER_IDS);
  if (adminIds.has(userId)) {
    return next();
  }

  return next(new AppError(ErrorKey.Forbidden, getErrorMessage(ErrorKey.Forbidden)));
};

