import express, { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';
import { ErrorKey, getErrorMessage } from '../constants/errorCatalog.js';
import { getThemeById, listThemes } from '../services/themeService.js';

const router = express.Router();

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

export default router;
