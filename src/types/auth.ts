import { User, Session } from '@supabase/supabase-js';

export interface AuthUser extends User {
  id: string;
  email?: string;
}

export interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
}

export interface AuthFormData {
  email: string;
  password: string;
  confirmPassword?: string;
}

export interface AuthError {
  message: string;
  field?: keyof AuthFormData;
}