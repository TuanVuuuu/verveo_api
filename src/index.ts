import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { z } from 'zod';
import { AIService } from './services/aiService.js';
import { HealthService } from './services/healthService.js';
import { registerUser, verifyEmail, loginUser } from './services/authService.js';
import { getUserTodos, createTodo } from './services/userService.js';
import { authenticateToken } from './middleware/auth.js';

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

app.post('/gen_todo', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parse = GenTodoRequest.safeParse(req.body);
    if (!parse.success) {
      return res.status(422).json({ error: 'Invalid request format', details: parse.error.flatten() });
    }
    const { prompt } = parse.data;
    const result = await aiService.generateTodoWithDeepseek(prompt);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Authentication routes
app.post('/auth/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parse = RegisterRequest.safeParse(req.body);
    if (!parse.success) {
      return res.status(422).json({ error: 'Invalid request format', details: parse.error.flatten() });
    }
    const { email, password, name } = parse.data;
    const result = await registerUser(email, password, name);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.get('/auth/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token is required' });
    }
    const result = await verifyEmail(token);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.post('/auth/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parse = LoginRequest.safeParse(req.body);
    if (!parse.success) {
      return res.status(422).json({ error: 'Invalid request format', details: parse.error.flatten() });
    }
    const { email, password } = parse.data;
    const result = await loginUser(email, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Todo routes (protected)
app.get('/todos', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId;
    const todos = await getUserTodos(userId);
    res.json(todos);
  } catch (err) {
    next(err);
  }
});

app.post('/todos', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parse = CreateTodoRequest.safeParse(req.body);
    if (!parse.success) {
      return res.status(422).json({ error: 'Invalid request format', details: parse.error.flatten() });
    }
    const userId = (req as any).user.userId;
    const todoData = { 
      ...parse.data, 
      user_id: userId,
      due: parse.data.due ? new Date(parse.data.due) : undefined
    };
    const todo = await createTodo(todoData);
    res.json(todo);
  } catch (err) {
    next(err);
  }
});

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('❌ Error:', err);
  return res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, HOST, () => {
  console.log(`✅ Server listening on http://${HOST}:${PORT}`);
});


