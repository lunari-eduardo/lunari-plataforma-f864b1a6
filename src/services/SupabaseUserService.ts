import { supabase } from '@/integrations/supabase/client';
import type { UserPreferences, RegimeTributario } from '@/types/userProfile';

export interface UserProfile {
  id: string;
  nome?: string;
  email?: string;
  telefone?: string;
  empresa?: string;
  logoUrl?: string;
}

export class SupabaseUserService {
  // ============= PROFILE =============
  
  async loadProfile(): Promise<UserProfile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error loading profile:', error);
      return null;
    }
    
    if (!data) return null;
    
    return {
      id: data.id,
      nome: data.nome || undefined,
      email: data.email || undefined,
      telefone: data.telefone || undefined,
      empresa: data.empresa || undefined,
      logoUrl: data.logo_url || undefined
    };
  }

  async saveProfile(profile: Partial<UserProfile>): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('profiles')
      .upsert({
        user_id: user.id,
        nome: profile.nome,
        email: profile.email,
        telefone: profile.telefone,
        empresa: profile.empresa,
        logo_url: profile.logoUrl
      });

    if (error) {
      console.error('Error saving profile:', error);
      throw error;
    }
  }

  // ============= PREFERENCES =============
  
  async loadPreferences(): Promise<UserPreferences> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return this.getDefaultPreferences();
    }

    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error loading preferences:', error);
      return this.getDefaultPreferences();
    }
    
    if (!data) {
      return this.getDefaultPreferences();
    }
    
    return {
      id: data.id,
      notificacoesWhatsapp: data.notificacoes_email || true,
      habilitarAutomacoesWorkflow: data.notificacoes_push || true,
      habilitarAlertaProdutosDoCliente: true,
      regimeTributario: data.regime_tributario as RegimeTributario || 'mei',
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async savePreferences(preferences: Partial<UserPreferences>): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const current = await this.loadPreferences();
    const updated = { ...current, ...preferences };

    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: user.id,
        notificacoes_email: updated.notificacoesWhatsapp,
        notificacoes_push: updated.habilitarAutomacoesWorkflow,
        regime_tributario: updated.regimeTributario,
        configuracoes_agenda: {},
        configuracoes_financeiro: {}
      });

    if (error) {
      console.error('Error saving preferences:', error);
      throw error;
    }
  }

  private getDefaultPreferences(): UserPreferences {
    return {
      id: '',
      notificacoesWhatsapp: true,
      habilitarAutomacoesWorkflow: true,
      habilitarAlertaProdutosDoCliente: true,
      regimeTributario: 'mei',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
}

export const supabaseUserService = new SupabaseUserService();