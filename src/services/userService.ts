import pool from '../config/database.js';
import { AppError } from '../utils/errors.js';
import { ErrorKey, getErrorMessage } from '../constants/errorCatalog.js';
import { Todo, CreateTodoData } from '../models/Todo.js';
import { DateTime } from '../utils/datetime.js';

export type ListTodosOptions = {
  startFrom?: Date;
  startTo?: Date;
  dueFrom?: Date;
  dueTo?: Date;
  page?: number;
  size?: number;
  sort?: 'start_time_asc' | 'start_time_desc';
  label?: string; // filter todos that contain this label in labels JSON array
  progress?: 'todo' | 'inprogress' | 'done';
  priority?: 'low' | 'medium' | 'high';
};

export const getUserTodos = async (userId: number, opts: ListTodosOptions = {}): Promise<Todo[]> => {
  const page = Math.max(1, opts.page ?? 1);
  const size = Math.min(100, Math.max(1, opts.size ?? 20));
  const offset = (page - 1) * size;
  const sortClause = (opts.sort ?? 'start_time_asc') === 'start_time_desc' ? 'DESC' : 'ASC';

  const where: string[] = ['user_id = ?'];
  const values: any[] = [userId];
  if (opts.startFrom) {
    where.push('start_time >= ?');
    values.push(opts.startFrom);
  }
  if (opts.startTo) {
    where.push('start_time <= ?');
    values.push(opts.startTo);
  }
  if (opts.dueFrom) {
    where.push('due >= ?');
    values.push(opts.dueFrom);
  }
  if (opts.dueTo) {
    where.push('due <= ?');
    values.push(opts.dueTo);
  }
  if (opts.label) {
    // labels is a JSON array; match if any element equals the label (case-sensitive by default)
    where.push("labels IS NOT NULL AND JSON_SEARCH(labels, 'one', ?) IS NOT NULL");
    values.push(opts.label);
  }
  if (opts.progress) {
    where.push('progress = ?');
    values.push(opts.progress);
  }
  if (opts.priority) {
    where.push('priority = ?');
    values.push(opts.priority);
  }

  const sql = `SELECT * FROM todos WHERE ${where.join(' AND ')} ORDER BY start_time ${sortClause}, id ${sortClause} LIMIT ? OFFSET ?`;
  values.push(size, offset);

  const [todos] = await pool.execute(sql, values);

  return (todos as any[]).map(todo => formatTodoResponse(todo));
};

/**
 * Format todo response with timestamp (milliseconds) instead of Date objects
 * All timestamps are in milliseconds and should be interpreted as Vietnam timezone (UTC+7)
 */
function formatTodoResponse(todo: any): any {
  return {
    ...todo,
    start_time: DateTime.toTimestamp(todo.start_time),
    end_time: DateTime.toTimestamp(todo.end_time),
    due: DateTime.toTimestamp(todo.due),
    created_at: DateTime.toTimestamp(todo.created_at),
    updated_at: DateTime.toTimestamp(todo.updated_at),
    labels: todo.labels ? JSON.parse(todo.labels) : null
  };
}

export const createTodo = async (todoData: CreateTodoData): Promise<Todo> => {
  const [result] = await pool.execute(
    'INSERT INTO todos (user_id, title, description, start_time, end_time, due, labels, priority, message, confidence, created_by, progress) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      todoData.user_id, 
      todoData.title, 
      todoData.description ?? null,
      todoData.start_time ?? null,
      todoData.end_time ?? null,
      todoData.due ?? null, 
      todoData.labels ? JSON.stringify(todoData.labels) : null, 
      todoData.priority ?? 'medium',
      todoData.message ?? null,
      todoData.confidence ?? null,
      todoData.created_by ?? null,
      todoData.progress || 'todo'
    ]
  );
  
  const todoId = (result as any).insertId;
  const [todos] = await pool.execute('SELECT * FROM todos WHERE id = ?', [todoId]);
  
  const todo = (todos as any[])[0];
  return formatTodoResponse(todo) as Todo;
};

export const updateTodo = async (todoId: number, todoData: any, userId: number): Promise<Todo> => {
  // Check if todo belongs to user
  const [todos] = await pool.execute(
    'SELECT id FROM todos WHERE id = ? AND user_id = ?',
    [todoId, userId]
  );
  
  if ((todos as any[]).length === 0) {
    throw new AppError(ErrorKey.TodoNotFound, getErrorMessage(ErrorKey.TodoNotFound));
  }
  
  // Update todo
  const updateFields = [];
  const values = [];
  
  if (todoData.title) {
    updateFields.push('title = ?');
    values.push(todoData.title);
  }
  
  if (todoData.description) {
    updateFields.push('description = ?');
    values.push(todoData.description);
  }
  
  if (todoData.start_time) {
    updateFields.push('start_time = ?');
    values.push(todoData.start_time);
  }
  
  if (todoData.end_time) {
    updateFields.push('end_time = ?');
    values.push(todoData.end_time);
  }
  
  if (todoData.due) {
    updateFields.push('due = ?');
    values.push(todoData.due);
  }
  
  if (todoData.labels) {
    updateFields.push('labels = ?');
    values.push(JSON.stringify(todoData.labels));
  }
  
  if (todoData.priority) {
    updateFields.push('priority = ?');
    values.push(todoData.priority);
  }
  
  if (todoData.message) {
    updateFields.push('message = ?');
    values.push(todoData.message);
  }
  
  if (todoData.confidence !== undefined) {
    updateFields.push('confidence = ?');
    values.push(todoData.confidence);
  }
  
  if (todoData.created_by) {
    updateFields.push('created_by = ?');
    values.push(todoData.created_by);
  }
  
  if (todoData.progress) {
    updateFields.push('progress = ?');
    values.push(todoData.progress);
  }
  
  values.push(todoId);
  
  await pool.execute(
    `UPDATE todos SET ${updateFields.join(', ')} WHERE id = ?`,
    values
  );
  
  // Return updated todo
  const [updatedTodos] = await pool.execute(
    'SELECT * FROM todos WHERE id = ?',
    [todoId]
  );
  
  const todo = (updatedTodos as any[])[0];
  return formatTodoResponse(todo) as Todo;
};

export const deleteTodo = async (todoId: number, userId: number): Promise<Todo> => {
  // Check if todo belongs to user and get data before deletion
  const [todos] = await pool.execute(
    'SELECT * FROM todos WHERE id = ? AND user_id = ?',
    [todoId, userId]
  );
  
  if ((todos as any[]).length === 0) {
    throw new AppError(ErrorKey.TodoNotFound, getErrorMessage(ErrorKey.TodoNotFound));
  }
  
  const todo = (todos as any[])[0];
  
  // Delete todo
  await pool.execute(
    'DELETE FROM todos WHERE id = ?',
    [todoId]
  );
  
  // Return the deleted todo data
  return formatTodoResponse(todo) as Todo;
};

export const createTodosBatch = async (todosData: CreateTodoData[]): Promise<Todo[]> => {
  if (todosData.length === 0) {
    return [];
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const todoIds: number[] = [];
    const insertSql = 'INSERT INTO todos (user_id, title, description, start_time, end_time, due, labels, priority, message, confidence, created_by, progress) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    
    for (const todo of todosData) {
      const [result] = await connection.query(insertSql, [
        todo.user_id,
        todo.title,
        todo.description ?? null,
        todo.start_time ?? null,
        todo.end_time ?? null,
        todo.due ?? null,
        todo.labels ? JSON.stringify(todo.labels) : null,
        todo.priority ?? 'medium',
        todo.message ?? null,
        todo.confidence ?? null,
        todo.created_by ?? null,
        todo.progress || 'todo'
      ]);
      todoIds.push((result as any).insertId);
    }

    const placeholders = todoIds.map(() => '?').join(',');
    const [createdTodos] = await connection.query(
      `SELECT * FROM todos WHERE id IN (${placeholders}) ORDER BY id ASC`,
      todoIds
    );

    await connection.commit();

    return (createdTodos as any[]).map(todo => formatTodoResponse(todo));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const getTodoEventDays = async (
  userId: number,
  from: Date,
  to: Date
): Promise<{ totalTodos: number; eventDays: { date: Date; todoCount: number }[] }> => {
  const [totalRows] = await pool.execute('SELECT COUNT(*) AS totalTodos FROM todos WHERE user_id = ?', [userId]);
  const totalTodos = (totalRows as any[])[0]?.totalTodos ? Number((totalRows as any[])[0].totalTodos) : 0;

  const [rows] = await pool.execute(
    `
      SELECT 
        DATE(CONVERT_TZ(COALESCE(start_time, due), '+00:00', '+07:00')) AS event_date,
        COUNT(*) AS todoCount
      FROM todos
      WHERE user_id = ?
        AND COALESCE(start_time, due) IS NOT NULL
        AND COALESCE(start_time, due) BETWEEN ? AND ?
      GROUP BY event_date
      ORDER BY event_date ASC
    `,
    [userId, from, to]
  );

  const eventDays = (rows as any[]).map((row) => ({
    date: new Date(row.event_date),
    todoCount: Number(row.todoCount)
  }));

  return { totalTodos, eventDays };
};
