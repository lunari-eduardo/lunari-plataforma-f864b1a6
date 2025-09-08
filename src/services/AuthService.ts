import { supabase } from '@/integrations/supabase/client';
import { AuthError } from '@supabase/supabase-js';

export class AuthService {
  /**
   * Sign up a new user
   */
  static async signUp(email: string, password: string) {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl
        }
      });

      if (error) {
        console.error('🔐 [AuthService] Sign up error:', error);
        return { data: null, error };
      }

      console.log('🔐 [AuthService] Sign up successful:', data);
      return { data, error: null };
    } catch (err) {
      console.error('🔐 [AuthService] Sign up exception:', err);
      return { 
        data: null, 
        error: { message: 'Erro inesperado durante o cadastro' } as AuthError 
      };
    }
  }

  /**
   * Sign in an existing user
   */
  static async signIn(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('🔐 [AuthService] Sign in error:', error);
        return { data: null, error };
      }

      console.log('🔐 [AuthService] Sign in successful:', data);
      return { data, error: null };
    } catch (err) {
      console.error('🔐 [AuthService] Sign in exception:', err);
      return { 
        data: null, 
        error: { message: 'Erro inesperado durante o login' } as AuthError 
      };
    }
  }

  /**
   * Sign out the current user
   */
  static async signOut() {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('🔐 [AuthService] Sign out error:', error);
        return { error };
      }

      console.log('🔐 [AuthService] Sign out successful');
      return { error: null };
    } catch (err) {
      console.error('🔐 [AuthService] Sign out exception:', err);
      return { error: { message: 'Erro inesperado durante o logout' } as AuthError };
    }
  }

  /**
   * Reset password for a user
   */
  static async resetPassword(email: string) {
    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl
      });

      if (error) {
        console.error('🔐 [AuthService] Reset password error:', error);
        return { error };
      }

      console.log('🔐 [AuthService] Reset password email sent');
      return { error: null };
    } catch (err) {
      console.error('🔐 [AuthService] Reset password exception:', err);
      return { error: { message: 'Erro inesperado ao enviar email de recuperação' } as AuthError };
    }
  }

  /**
   * Update user password
   */
  static async updatePassword(password: string) {
    try {
      const { error } = await supabase.auth.updateUser({
        password
      });

      if (error) {
        console.error('🔐 [AuthService] Update password error:', error);
        return { error };
      }

      console.log('🔐 [AuthService] Password updated successfully');
      return { error: null };
    } catch (err) {
      console.error('🔐 [AuthService] Update password exception:', err);
      return { error: { message: 'Erro inesperado ao atualizar senha' } as AuthError };
    }
  }

  /**
   * Get current session
   */
  static async getCurrentSession() {
    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error('🔐 [AuthService] Get session error:', error);
        return { session: null, error };
      }

      return { session: data.session, error: null };
    } catch (err) {
      console.error('🔐 [AuthService] Get session exception:', err);
      return { 
        session: null, 
        error: { message: 'Erro ao verificar sessão' } as AuthError 
      };
    }
  }

  /**
   * Get current user
   */
  static async getCurrentUser() {
    try {
      const { data, error } = await supabase.auth.getUser();

      if (error) {
        console.error('🔐 [AuthService] Get user error:', error);
        return { user: null, error };
      }

      return { user: data.user, error: null };
    } catch (err) {
      console.error('🔐 [AuthService] Get user exception:', err);
      return { 
        user: null, 
        error: { message: 'Erro ao verificar usuário' } as AuthError 
      };
    }
  }
}