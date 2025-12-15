export interface User {
  id: number;
  email: string;
  password_hash: string | null;
  name: string;
  is_verified: boolean;
  verification_token: string | null;
  google_id: string | null;
  apple_id: string | null;
  auth_provider: 'email' | 'google' | 'apple';
  created_at: Date;
}

export interface CreateUserData {
  email: string;
  password_hash: string;
  name: string;
  verification_token: string;
}
