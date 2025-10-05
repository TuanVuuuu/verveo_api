export interface Todo {
  id: number;
  user_id: number;
  title: string;
  description?: string;
  start_time?: Date | null;
  end_time?: Date | null;
  due?: Date | null;
  labels?: string[];
  priority: 'low' | 'medium' | 'high';
  message?: string;
  confidence?: number;
  created_by?: string;
  progress: 'todo' | 'inprogress' | 'done';
  created_at: Date;
  updated_at: Date;
}

export interface CreateTodoData {
  user_id: number;
  title: string;
  description?: string;
  start_time?: Date;
  end_time?: Date;
  due?: Date;
  labels?: string[];
  priority?: 'low' | 'medium' | 'high';
  message?: string;
  confidence?: number;
  created_by?: string;
  progress?: 'todo' | 'inprogress' | 'done';
}
