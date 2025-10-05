import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
import { getUserTodos, createTodo, updateTodo, deleteTodo } from '../services/userService.js';
import { AppError } from '../utils/errors.js';
import { ErrorKey, getErrorMessage } from '../constants/errorCatalog.js';
import { AIService } from '../services/aiService.js';

const router = express.Router();
const aiService = new AIService();

const GenTodoRequest = z.object({
  prompt: z.string().min(1)
});

const UpdateTodoRequest = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  start_time: z.string().datetime().optional(),
  end_time: z.string().datetime().optional(),
  due: z.string().datetime().optional(),
  labels: z.any().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  message: z.string().optional(),
  confidence: z.number().optional(),
  created_by: z.string().optional(),
  progress: z.enum(['todo', 'inprogress', 'done']).optional()
});

// Reuse UpdateTodoRequest for manual creation (title will be checked at runtime)

router.get('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId;
    const todos = await getUserTodos(userId);
    res.json(todos);
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId;
    const parse = GenTodoRequest.safeParse(req.body);
    if (!parse.success) {
      return next(new AppError(ErrorKey.RequestInvalid, getErrorMessage(ErrorKey.RequestInvalid)));
    }
    const aiResult = await aiService.generateTodoWithDeepseek(parse.data.prompt);

    const todoData = {
      user_id: userId,
      title: aiResult.title,
      description: aiResult.description,
      start_time: aiResult.startTime ? new Date(aiResult.startTime) : undefined,
      end_time: aiResult.endTime ? new Date(aiResult.endTime) : undefined,
      due: aiResult.startTime ? new Date(aiResult.startTime) : undefined,
      labels: aiResult.labels || undefined,
      priority: aiResult.priority || 'medium',
      message: aiResult.message,
      confidence: aiResult.confidence,
      created_by: aiResult.createdBy || undefined,
      progress: 'todo' as const
    };

    const savedTodo = await createTodo(todoData);
    res.json(savedTodo);
  } catch (err) {
    next(err);
  }
});

// Manual create todo (created_by='User', confidence=1)
router.post('/create-manual', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId;
    const parse = UpdateTodoRequest.safeParse(req.body);
    if (!parse.success) {
      return next(new AppError(ErrorKey.RequestInvalid, getErrorMessage(ErrorKey.RequestInvalid)));
    }
    const payload = parse.data;
    if (!payload.title) {
      return next(new AppError(ErrorKey.RequestInvalid, getErrorMessage(ErrorKey.RequestInvalid)));
    }
    const savedTodo = await createTodo({
      user_id: userId,
      title: payload.title,
      description: payload.description,
      start_time: payload.start_time ? new Date(payload.start_time) : undefined,
      end_time: payload.end_time ? new Date(payload.end_time) : undefined,
      due: payload.due ? new Date(payload.due) : payload.start_time ? new Date(payload.start_time) : undefined,
      labels: (payload as any).labels || undefined,
      priority: payload.priority || 'medium',
      message: payload.message,
      confidence: 1,
      created_by: 'User',
      progress: 'todo'
    });
    res.json(savedTodo);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const todoId = parseInt(req.params.id);
    const userId = (req as any).user.userId;
    const parse = UpdateTodoRequest.safeParse(req.body);
    if (!parse.success) {
      return next(new AppError(ErrorKey.RequestInvalid, getErrorMessage(ErrorKey.RequestInvalid)));
    }
    const payload = parse.data;
    const todoData = {
      ...payload,
      start_time: payload.start_time ? new Date(payload.start_time) : undefined,
      end_time: payload.end_time ? new Date(payload.end_time) : undefined,
      due: payload.due ? new Date(payload.due) : undefined
    };
    const updated = await updateTodo(todoId, todoData as any, userId);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const todoId = parseInt(req.params.id);
    const userId = (req as any).user.userId;
    const deleted = await deleteTodo(todoId, userId);
    res.json({ message: 'Todo deleted successfully', deletedTodo: deleted });
  } catch (err) {
    next(err);
  }
});

export default router;


