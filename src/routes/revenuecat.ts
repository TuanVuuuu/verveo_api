import { Router } from 'express';
import { handleWebhook } from '../controllers/revenuecatController.js';
import { verifyRevenueCatWebhook } from '../middleware/revenuecatAuth.js';
import { authenticateToken } from '../middleware/auth.js';
import { getActiveSubscriptionByUserId } from '../services/subscriptionService.js';

const router = Router();

router.post('/webhook', verifyRevenueCatWebhook, handleWebhook);

router.get('/status', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user.userId;
    const subscription = await getActiveSubscriptionByUserId(userId);

    res.json({
      status: 0,
      message: 'success',
      data: subscription
        ? {
            isActive: subscription.is_active,
            productId: subscription.product_id,
            entitlementId: subscription.entitlement_id,
            status: subscription.subscription_status,
            expiresAt: subscription.expires_at?.getTime() || null,
            platform: subscription.platform
          }
        : {
            isActive: false,
            productId: null,
            entitlementId: null,
            status: null,
            expiresAt: null,
            platform: null
          }
    });
  } catch (error) {
    next(error);
  }
});

export default router;

