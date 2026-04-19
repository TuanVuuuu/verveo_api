import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdminOrService } from '../middleware/admin.js';
import { AppError } from '../utils/errors.js';
import { ErrorKey, getErrorMessage } from '../constants/errorCatalog.js';
import { createTheme, deleteTheme, getThemeById, listThemes } from '../services/themeService.js';

const router = express.Router();

const ThemeViewSchema = z
  .object({
    isStatusDark: z.boolean().optional(),
  })
  .passthrough();

const ThemeSchema = z
  .object({
    id: z.string().min(1).optional(),
    name: z.string().min(1),
    calendarCategory: z.string().min(1),
    calendarCategoryDisplay: z.string().min(1),
    imgUrl: z.string().min(1),
    blurHash: z.string().min(1).optional(),
    calendarMonthlyView: ThemeViewSchema,
    calendarWeeklyView: ThemeViewSchema,
    homeView: ThemeViewSchema,
  })
  .passthrough();

const parseUrlHost = (raw: string): string | null => {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' ? u.host : null;
  } catch {
    return null;
  }
};

const getHostWhitelist = (): Set<string> => {
  const base = new Set<string>(['firebasestorage.googleapis.com', 'storage.googleapis.com']);
  const env = process.env.THEME_ASSET_HOST_WHITELIST || '';
  env
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((h) => base.add(h));
  return base;
};

const validateThemeAssets = (theme: any) => {
  const whitelist = getHostWhitelist();
  const url = theme?.imgUrl || theme?.calendarMonthlyView?.imgUrl || theme?.calendarWeeklyView?.imgUrl || theme?.homeView?.imgUrl;
  if (!url) {
    throw new AppError(ErrorKey.RequestInvalid, 'imgUrl is required');
  }
  // Normalize to top-level
  theme.imgUrl = url;

  const host = parseUrlHost(String(url));
  if (!host) {
    throw new AppError(ErrorKey.RequestInvalid, 'imgUrl must be a valid HTTPS URL');
  }
  if (whitelist.size > 0 && !whitelist.has(host)) {
    throw new AppError(ErrorKey.RequestInvalid, `imgUrl host not allowed: ${host}`);
  }
};

// GET /app/themes
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await listThemes();
    res.json({
      status: 0,
      message: 'success',
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// GET /app/themes/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) {
      return next(new AppError(ErrorKey.RequestInvalid, getErrorMessage(ErrorKey.RequestInvalid)));
    }
    const result = await getThemeById(id);
    res.json({
      status: 0,
      message: 'success',
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// POST /app/themes (admin/service)
router.post('/', authenticateToken, requireAdminOrService, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Explicit validation to return required message (instead of generic Zod error)
    const anyBody = req.body as any;
    const candidateImgUrl =
      anyBody?.imgUrl ||
      anyBody?.calendarMonthlyView?.imgUrl ||
      anyBody?.calendarWeeklyView?.imgUrl ||
      anyBody?.homeView?.imgUrl;
    if (!candidateImgUrl) {
      return next(new AppError(ErrorKey.RequestInvalid, 'imgUrl is required'));
    }

    const parse = ThemeSchema.safeParse(req.body);
    if (!parse.success) {
      return next(new AppError(ErrorKey.RequestInvalid, getErrorMessage(ErrorKey.RequestInvalid)));
    }

    const theme = parse.data as any;
    if (!theme.id) {
      theme.id = `theme_${Date.now()}`;
    }

    validateThemeAssets(theme);

    // auto-generate blurHash when missing
    const { ensureThemeBlurHashes } = await import('../services/blurhashService.js');
    await ensureThemeBlurHashes(theme);

    const result = await createTheme(theme);
    res.json({
      status: 0,
      message: 'success',
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /app/themes/:id (admin/service)
router.delete(
  '/:id',
  authenticateToken,
  requireAdminOrService,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return next(new AppError(ErrorKey.RequestInvalid, getErrorMessage(ErrorKey.RequestInvalid)));
      }
      const result = await deleteTheme(id);
      res.json({
        status: 0,
        message: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

