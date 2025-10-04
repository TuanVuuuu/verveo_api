export interface Todo {
  id: number;
  user_id: number;
  title: string;
  due: Date | null;
  labels: any;
  priority: 'low' | 'medium' | 'high';
  created_at: Date;
  updated_at: Date;
}

export interface CreateTodoData {
  user_id: number;
  title: string;
  due?: Date;
  labels?: any;
  priority?: 'low' | 'medium' | 'high';
}
