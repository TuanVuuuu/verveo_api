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
