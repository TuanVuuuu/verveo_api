export interface User {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  is_verified: boolean;
  verification_token: string | null;
  created_at: Date;
}

export interface CreateUserData {
  email: string;
  password_hash: string;
  name: string;
  verification_token: string;
}
