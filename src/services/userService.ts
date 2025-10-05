import pool from '../config/database.js';
import { Todo, CreateTodoData } from '../models/Todo.js';

export const getUserTodos = async (userId: number): Promise<Todo[]> => {
  const [todos] = await pool.execute(
    'SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  
  return todos as Todo[];
};

export const createTodo = async (todoData: CreateTodoData): Promise<Todo> => {
  const [result] = await pool.execute(
    'INSERT INTO todos (user_id, title, due, labels, priority) VALUES (?, ?, ?, ?, ?)',
    [todoData.user_id, todoData.title, todoData.due, JSON.stringify(todoData.labels), todoData.priority]
  );
  
  const todoId = (result as any).insertId;
  const [todos] = await pool.execute('SELECT * FROM todos WHERE id = ?', [todoId]);
  
  return (todos as any[])[0] as Todo;
};

export const updateTodo = async (todoId: number, todoData: any, userId: number): Promise<Todo> => {
  // Check if todo belongs to user
  const [todos] = await pool.execute(
    'SELECT id FROM todos WHERE id = ? AND user_id = ?',
    [todoId, userId]
  );
  
  if ((todos as any[]).length === 0) {
    throw new Error('Todo not found or access denied');
  }
  
  // Update todo
  const updateFields = [];
  const values = [];
  
  if (todoData.title) {
    updateFields.push('title = ?');
    values.push(todoData.title);
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
  
  return (updatedTodos as any[])[0] as Todo;
};

export const deleteTodo = async (todoId: number, userId: number): Promise<void> => {
  // Check if todo belongs to user
  const [todos] = await pool.execute(
    'SELECT id FROM todos WHERE id = ? AND user_id = ?',
    [todoId, userId]
  );
  
  if ((todos as any[]).length === 0) {
    throw new Error('Todo not found or access denied');
  }
  
  // Delete todo
  await pool.execute(
    'DELETE FROM todos WHERE id = ?',
    [todoId]
  );
};
