import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
import { getUserTodos, createTodo, updateTodo, deleteTodo, createTodosBatch, getTodoEventDays, ListTodosOptions } from '../services/userService.js';
import { AppError } from '../utils/errors.js';
import { ErrorKey, getErrorMessage } from '../constants/errorCatalog.js';
import { AIService } from '../services/aiService.js';
import { DateTime } from '../utils/datetime.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
const aiService = new AIService();

const GenTodoRequest = z.object({
  prompt: z.string().min(1)
});

const UpdateTodoRequest = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  start_time: z.union([z.string(), z.number()]).optional(), // Accept timestamp (number) or datetime string
  end_time: z.union([z.string(), z.number()]).optional(), // Accept timestamp (number) or datetime string
  due: z.union([z.string(), z.number()]).optional(), // Accept timestamp (number) or datetime string
  labels: z.any().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  message: z.string().optional(),
  created_by: z.string().optional(),
  progress: z.enum(['todo', 'inprogress', 'done']).optional()
});

// Reuse UpdateTodoRequest for manual creation (title will be checked at runtime)

const BatchImportRequest = z.object({
  todos: z.array(UpdateTodoRequest).min(1).max(100)
});

const EventDaysQuery = z.object({
  dateFrom: z.string(),
  dateTo: z.string(),
  // Optional timezone offset in minutes (e.g. +420 for UTC+7, -300 for UTC-5).
  // If not provided, backend will default to UTC+7 for backward compatibility.
  offsetMinutes: z.string().optional()
});

router.get('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId;
    const { page, size, sort, startFrom, startTo, dueFrom, dueTo, label, progress, priority } = req.query as Record<string, string>;

    const parseTs = (v?: string) => {
      if (!v) return undefined;
      // support both seconds and milliseconds
      const n = Number(v);
      if (!isFinite(n)) return new Date(v);
      return new Date(n >= 1e12 ? n : n * 1000);
    };
    const opts: ListTodosOptions = {
      page: page ? parseInt(page) : undefined,
      size: size ? parseInt(size) : undefined,
      sort: sort === 'start_time_desc' ? 'start_time_desc' : 'start_time_asc',
      startFrom: parseTs(startFrom),
      startTo: parseTs(startTo),
      dueFrom: parseTs(dueFrom),
      dueTo: parseTs(dueTo),
      label: label || undefined,
      progress: progress === 'todo' || progress === 'inprogress' || progress === 'done' ? (progress as any) : undefined,
      priority: priority === 'low' || priority === 'medium' || priority === 'high' ? (priority as any) : undefined
    };
    const todos = await getUserTodos(userId, opts);
    res.json(todos);
  } catch (err) {
    next(err);
  }
});

router.get('/event-days', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId;
    const parse = EventDaysQuery.safeParse(req.query);
    if (!parse.success) {
      return next(new AppError(ErrorKey.RequestInvalid, getErrorMessage(ErrorKey.RequestInvalid)));
    }

    const { dateFrom, dateTo, offsetMinutes } = parse.data;

    const parseDateTime = (v: string): Date | null => {
      if (!v) return null;
      const n = Number(v);
      if (isFinite(n)) {
        return new Date(n >= 1e12 ? n : n * 1000);
      }
      const d = new Date(v);
      if (isNaN(d.getTime())) return null;
      return d;
    };

    const from = parseDateTime(dateFrom);
    const to = parseDateTime(dateTo);

    if (!from || !to || from > to) {
      return next(new AppError(ErrorKey.RequestInvalid, getErrorMessage(ErrorKey.RequestInvalid)));
    }

    const offset = offsetMinutes !== undefined ? parseInt(offsetMinutes, 10) : 420;
    const { totalTodos, eventDays } = await getTodoEventDays(userId, from, to, offset);

    res.json({
      summary: {
        totalTodos,
        totalEventDaysInQuery: eventDays.length
      },
      eventDays: eventDays.map((d) => ({
        date: d.date.toISOString(),
        todoCount: d.todoCount
      }))
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parse = GenTodoRequest.safeParse(req.body);
    if (!parse.success) {
      return next(new AppError(ErrorKey.RequestInvalid, getErrorMessage(ErrorKey.RequestInvalid)));
    }
    const aiResult = await aiService.generateTodoWithDeepseek(parse.data.prompt);

    const todoResponse = {
      title: aiResult.title,
      description: aiResult.description,
      start_time: aiResult.startTime ? DateTime.toTimestamp(new Date(aiResult.startTime)) : null,
      end_time: aiResult.endTime ? DateTime.toTimestamp(new Date(aiResult.endTime)) : null,
      due: aiResult.startTime ? DateTime.toTimestamp(new Date(aiResult.startTime)) : null,
      labels: aiResult.labels || undefined,
      priority: aiResult.priority || 'medium',
      message: aiResult.message,
      created_by: aiResult.createdBy || undefined,
      progress: 'todo' as const
    };

    logger.info('POST /todos response:', JSON.stringify(todoResponse, null, 2));
    
    try {
      JSON.stringify(todoResponse);
      logger.info('POST /todos response is serializable');
    } catch (serializeError) {
      logger.error('POST /todos response serialization error:', serializeError);
      return next(new AppError(ErrorKey.Internal, 'Response serialization failed'));
    }
    
    try {
      res.json(todoResponse);
      logger.info('POST /todos response sent successfully');
    } catch (sendError) {
      logger.error('POST /todos failed to send response:', sendError);
      return next(new AppError(ErrorKey.Internal, 'Failed to send response'));
    }
  } catch (err) {
    logger.error('POST /todos error:', err);
    next(err);
  }
});

// Manual create todo (created_by='User')
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
    
    // Parse timestamp or datetime string to Date
    const parseDateTime = (v?: string | number): Date | undefined => {
      if (v === undefined || v === null) return undefined;
      // If it's a number (timestamp), parse it
      if (typeof v === 'number') {
        return new Date(v >= 1e12 ? v : v * 1000); // Support both seconds and milliseconds
      }
      // If it's a string, try to parse as number first
      const n = Number(v);
      if (!isNaN(n) && isFinite(n)) {
        return new Date(n >= 1e12 ? n : n * 1000); // Support both seconds and milliseconds
      }
      // Otherwise, parse as ISO string
      return new Date(v);
    };
    
    const savedTodo = await createTodo({
      user_id: userId,
      title: payload.title,
      description: payload.description,
      start_time: parseDateTime(payload.start_time),
      end_time: parseDateTime(payload.end_time),
      due: parseDateTime(payload.due) || parseDateTime(payload.start_time),
      labels: (payload as any).labels || undefined,
      priority: payload.priority || 'medium',
      message: payload.message,
      created_by: 'User',
      progress: 'todo'
    });
    res.json(savedTodo);
  } catch (err) {
    next(err);
  }
});

router.post('/batch_import', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId;
    const parse = BatchImportRequest.safeParse(req.body);
    if (!parse.success) {
      return next(new AppError(ErrorKey.RequestInvalid, getErrorMessage(ErrorKey.RequestInvalid)));
    }
    const { todos } = parse.data;
    
    // Validate all todos have title
    const invalidTodos = todos.filter(todo => !todo.title);
    if (invalidTodos.length > 0) {
      return next(new AppError(ErrorKey.RequestInvalid, getErrorMessage(ErrorKey.RequestInvalid)));
    }
    
    // Parse timestamp or datetime string to Date
    const parseDateTime = (v?: string | number): Date | undefined => {
      if (v === undefined || v === null) return undefined;
      // If it's a number (timestamp), parse it
      if (typeof v === 'number') {
        return new Date(v >= 1e12 ? v : v * 1000); // Support both seconds and milliseconds
      }
      // If it's a string, try to parse as number first
      const n = Number(v);
      if (!isNaN(n) && isFinite(n)) {
        return new Date(n >= 1e12 ? n : n * 1000); // Support both seconds and milliseconds
      }
      // Otherwise, parse as ISO string
      return new Date(v);
    };
    
    const todosData = todos.map(todo => ({
      user_id: userId,
      title: todo.title!,
      description: todo.description,
      start_time: parseDateTime(todo.start_time),
      end_time: parseDateTime(todo.end_time),
      due: parseDateTime(todo.due) || parseDateTime(todo.start_time),
      labels: (todo as any).labels || undefined,
      priority: todo.priority || 'medium',
      message: todo.message,
      created_by: 'User',
      progress: 'todo' as const
    }));
    
    const savedTodos = await createTodosBatch(todosData);
    res.json(savedTodos);
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
    
    // Parse timestamp or datetime string to Date
    const parseDateTime = (v?: string | number): Date | undefined => {
      if (v === undefined || v === null) return undefined;
      // If it's a number (timestamp), parse it
      if (typeof v === 'number') {
        return new Date(v >= 1e12 ? v : v * 1000); // Support both seconds and milliseconds
      }
      // If it's a string, try to parse as number first
      const n = Number(v);
      if (!isNaN(n) && isFinite(n)) {
        return new Date(n >= 1e12 ? n : n * 1000); // Support both seconds and milliseconds
      }
      // Otherwise, parse as ISO string
      return new Date(v);
    };
    
    const todoData = {
      ...payload,
      start_time: parseDateTime(payload.start_time),
      end_time: parseDateTime(payload.end_time),
      due: parseDateTime(payload.due)
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


