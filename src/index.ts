import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { z } from 'zod';
import { AIService } from './services/aiService.js';
import { HealthService } from './services/healthService.js';
import authRouter from './routes/auth.js';
import todosRouter from './routes/todos.js';
import fcmRouter from './routes/fcm.js';
import notificationRouter from './routes/notification.js';
import { isAppError, buildErrorPayload } from './utils/errors.js';
import { ErrorKey } from './constants/errorCatalog.js';
import { fcmService } from './services/fcmService.js';
import { initializeQueue } from './queues/notificationQueue.js';
import { initializeRedisLock } from './config/redlock.js';
import { startNotificationCron } from './jobs/notificationCron.js';
import { startCleanupCron } from './jobs/cleanupCron.js';
import { startAccountDeletionCron } from './jobs/accountDeletionCron.js';
import { scheduledNotificationService } from './services/scheduledNotificationService.js';
import { logger } from './utils/logger.js';

const app = express();

// Config
const APP_TITLE = process.env.APP_TITLE || 'Verveo Todo Generator API (Node)';
const APP_VERSION = process.env.APP_VERSION || '2.0.4';
const APP_DESCRIPTION = process.env.APP_DESCRIPTION || 'API thông minh để tạo todo từ prompt sử dụng DeepSeek AI';
const HOST = process.env.HOST || '0.0.0.0';
const PORT = parseInt(process.env.PORT || '8000', 10);

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Serve static files from public directory
app.use(express.static('public'));

// Services
const aiService = new AIService();
const healthService = new HealthService(aiService, PORT, APP_VERSION);

// Startup log
console.log(`🚀 ${APP_TITLE} v${APP_VERSION} starting...`);
console.log(`🔑 OpenRouter API: ${aiService.openrouterApiKey ? '✅' : '❌'}`);

// Schemas
const GenTodoRequest = z.object({
  prompt: z.string().min(1)
});

const RegisterRequest = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1)
});

const LoginRequest = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const CreateTodoRequest = z.object({
  title: z.string().min(1),
  due: z.string().datetime().optional(),
  labels: z.any().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional()
});

// Routes
app.get('/', (_req: Request, res: Response) => {
  res.json({ message: `${APP_TITLE} is running!`, version: APP_VERSION, description: APP_DESCRIPTION });
});

app.get('/ping', (_req: Request, res: Response) => {
  res.json(healthService.getPingResponse());
});

app.get('/health', async (_req: Request, res: Response) => {
  const health = await healthService.getHealthResponse();
  res.json(health);
});


// Mount routers
app.use('/auth', authRouter);
app.use('/todos', todosRouter);
app.use('/fcm', fcmRouter);
app.use('/notifications', notificationRouter);

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('❌ Error:', err);

  // Helper: quyết định HTTP status gửi ra ngoài
  const decideHttpStatus = (errorKey: string, defaultStatus: number): number => {
    // Chỉ 3 trường hợp đặc biệt dùng HTTP code thật:
    // - 401: token hết hạn
    // - 403: không có quyền
    // - 500: lỗi hệ thống
    if (errorKey === ErrorKey.AuthTokenExpired) {
      return 401;
    }
    if (errorKey === ErrorKey.Forbidden || errorKey === ErrorKey.Unauthorized) {
      return 403;
    }
    if (errorKey === ErrorKey.Internal) {
      return 500;
    }
    if (defaultStatus === 500) {
      return 500;
    }
    // Các lỗi còn lại → luôn trả về 200
    return 200;
  };

  if (isAppError(err)) {
    const httpStatus = decideHttpStatus(err.key, err.status);
    return res.status(httpStatus).json(buildErrorPayload(err.status, err.key, err.description));
  }

  // Validation errors from Zod
  if (typeof err === 'object' && err && 'issues' in (err as any)) {
    const key = ErrorKey.RequestInvalid;
    const httpStatus = decideHttpStatus(key, 422);
    return res
      .status(httpStatus)
      .json(buildErrorPayload(422, key, 'Invalid request format'));
  }

  // Unknown / internal error
  const key = ErrorKey.Internal;
  const httpStatus = decideHttpStatus(key, 500);
  return res
    .status(httpStatus)
    .json(buildErrorPayload(500, key, 'Internal Server Error'));
});

async function startServer() {
  try {
    // Initialize Firebase Admin SDK
    fcmService.initializeFirebase();
    
    // Initialize Redis Queue and Distributed Lock
    if (process.env.ENABLE_CRON === 'true') {
      try {
        await initializeRedisLock();
      } catch (error) {
        logger.warn('⚠️ Failed to initialize Redlock (distributed lock):', error);
        logger.warn('⚠️ Cron will use local lock only - not suitable for multi-server deployment');
      }
      
      try {
        initializeQueue();
        logger.info('✅ Notification queue initialized');
      } catch (error) {
        logger.warn('⚠️ Failed to initialize queue, notifications will be sent directly:', error);
      }
      
      // Catch up missed notifications on startup
      logger.info('🚀 Running startup catch-up for missed notifications...');
      await scheduledNotificationService.catchUpMissedNotifications();
      
      // Start cron jobs
      startNotificationCron();
      startCleanupCron();
      startAccountDeletionCron();
      logger.info('✅ Cron jobs started');
    } else {
      logger.info('⚠️ Cron jobs disabled (set ENABLE_CRON=true to enable)');
    }
    
    // Start HTTP server
    app.listen(PORT, HOST, () => {
      console.log(`✅ Server listening on http://${HOST}:${PORT}`);
      logger.info(`🚀 ${APP_TITLE} v${APP_VERSION} ready`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();


