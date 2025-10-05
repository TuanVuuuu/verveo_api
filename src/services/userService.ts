import pool from '../config/database.js';
import { AppError } from '../utils/errors.js';
import { ErrorKey, getErrorMessage } from '../constants/errorCatalog.js';
import { Todo, CreateTodoData } from '../models/Todo.js';

export type ListTodosOptions = {
  startFrom?: Date;
  startTo?: Date;
  page?: number;
  size?: number;
  sort?: 'start_time_asc' | 'start_time_desc';
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

  const sql = `SELECT * FROM todos WHERE ${where.join(' AND ')} ORDER BY start_time ${sortClause}, id ${sortClause} LIMIT ? OFFSET ?`;
  values.push(size, offset);

  const [todos] = await pool.execute(sql, values);

  return (todos as any[]).map(todo => ({
    ...todo,
    labels: todo.labels ? JSON.parse(todo.labels) : null
  }));
};

export const createTodo = async (todoData: CreateTodoData): Promise<Todo> => {
  const [result] = await pool.execute(
    'INSERT INTO todos (user_id, title, description, start_time, end_time, due, labels, priority, message, confidence, created_by, progress) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      todoData.user_id, 
      todoData.title, 
      todoData.description,
      todoData.start_time,
      todoData.end_time,
      todoData.due, 
      todoData.labels ? JSON.stringify(todoData.labels) : null, 
      todoData.priority,
      todoData.message,
      todoData.confidence,
      todoData.created_by,
      todoData.progress || 'todo'
    ]
  );
  
  const todoId = (result as any).insertId;
  const [todos] = await pool.execute('SELECT * FROM todos WHERE id = ?', [todoId]);
  
  const todo = (todos as any[])[0];
  return {
    ...todo,
    labels: todo.labels ? JSON.parse(todo.labels) : null
  } as Todo;
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
  return {
    ...todo,
    labels: todo.labels ? JSON.parse(todo.labels) : null
  } as Todo;
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
  return {
    ...todo,
    labels: todo.labels ? JSON.parse(todo.labels) : null
  } as Todo;
};
