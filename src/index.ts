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
import { isAppError, buildErrorPayload } from './utils/errors.js';

const app = express();

// Config
const APP_TITLE = process.env.APP_TITLE || 'Verveo Todo Generator API (Node)';
const APP_VERSION = process.env.APP_VERSION || '2.0.0';
const APP_DESCRIPTION = process.env.APP_DESCRIPTION || 'API thông minh để tạo todo từ prompt sử dụng DeepSeek AI';
const HOST = process.env.HOST || '0.0.0.0';
const PORT = parseInt(process.env.PORT || '8000', 10);

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

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

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('❌ Error:', err);
  if (isAppError(err)) {
    return res.status(err.status).json(buildErrorPayload(err.status, err.key, err.description));
  }
  // Validation errors from Zod
  if (typeof err === 'object' && err && 'issues' in (err as any)) {
    return res.status(422).json(buildErrorPayload(422, 'error.request.invalid', 'Invalid request format'));
  }
  return res.status(500).json(buildErrorPayload(500, 'error.internal', 'Internal Server Error'));
});

app.listen(PORT, HOST, () => {
  console.log(`✅ Server listening on http://${HOST}:${PORT}`);
});


