import { Router } from 'express';
import { fcmController } from '../controllers/fcmController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

const optionalAuth = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    authenticateToken(req, res, next);
  } else {
    next();
  }
};

router.post('/register', optionalAuth, (req, res, next) => {
  fcmController.registerDevice(req, res).catch(next);
});

router.post('/unregister', authenticateToken, (req, res, next) => {
  fcmController.unregisterDevice(req, res).catch(next);
});

router.put('/settings', optionalAuth, (req, res, next) => {
  fcmController.updateSettings(req, res).catch(next);
});

router.get('/devices', authenticateToken, (req, res, next) => {
  fcmController.getDevices(req, res).catch(next);
});

router.delete('/devices/:deviceId', authenticateToken, (req, res, next) => {
  fcmController.deleteDevice(req, res).catch(next);
});

router.delete('/devices', authenticateToken, (req, res, next) => {
  fcmController.deleteAllDevices(req, res).catch(next);
});

export default router;
