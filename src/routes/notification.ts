import { Router } from 'express';
import { notificationController } from '../controllers/notificationController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/preferences', authenticateToken, (req, res, next) => {
  notificationController.getPreferences(req, res).catch(next);
});

router.put('/preferences', authenticateToken, (req, res, next) => {
  notificationController.updatePreferences(req, res).catch(next);
});

export default router;
