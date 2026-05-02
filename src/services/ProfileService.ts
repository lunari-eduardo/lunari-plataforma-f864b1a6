import { supabase } from '@/integrations/supabase/client';

export interface UserProfile {
  id: string;
  user_id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  empresa: string | null;
  logo_url: string | null;
  avatar_url: string | null;
  cpf_cnpj: string | null;
  endereco_comercial: string | null;
  telefones: string[] | null;
  site_redes_sociais: string[] | null;
  is_onboarding_complete: boolean;
  nicho: string | null;
  cidade_ibge_id: number | null;
  cidade_nome: string | null;
  cidade_uf: string | null;
  created_at: string;
  updated_at: string;
}

export class ProfileService {
  /**
   * Buscar perfil do usuário
   */
  static async getProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar perfil:', error);
      throw error;
    }

    return data;
  }

  /**
   * Atualizar perfil do usuário (com UPSERT automático)
   */
  static async updateProfile(
    userId: string,
    updates: Partial<Omit<UserProfile, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<UserProfile> {
    // Primeiro, tentar fazer UPDATE normal
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    // Se UPDATE não encontrou nenhuma linha (erro PGRST116), criar o perfil
    if (error?.code === 'PGRST116') {
      const { data: insertData, error: insertError } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          email: updates.email || '',
          ...updates
        })
        .select()
        .single();

      if (insertError) {
        console.error('Erro ao criar perfil:', insertError);
        throw insertError;
      }

      return insertData;
    }

    if (error) {
      console.error('Erro ao atualizar perfil:', error);
      throw error;
    }

    return data;
  }

  /**
   * Fazer upload de avatar (Cloudflare R2)
   */
  static async uploadAvatar(userId: string, file: File): Promise<string> {
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error('Tipo de arquivo inválido. Apenas JPG, PNG e WEBP são permitidos.');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Arquivo muito grande. Tamanho máximo: 5MB');
    }

    // Remover avatar anterior (se existir e estiver no R2)
    const current = await this.getProfile(userId);
    if (current?.avatar_url && current.avatar_url.includes('media.lunarihub.com/avatars/')) {
      const oldPath = current.avatar_url.split('media.lunarihub.com/')[1];
      if (oldPath) {
        try {
          await supabase.functions.invoke('r2-delete', { body: { storagePath: oldPath } });
        } catch (e) {
          console.warn('Falha ao remover avatar antigo:', e);
        }
      }
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('context', 'avatar');

    const { data, error } = await supabase.functions.invoke('r2-upload', { body: formData });
    if (error) throw new Error(error.message || 'Erro no upload');
    if (!data?.success || !data?.url) throw new Error(data?.error || 'Upload falhou');

    await this.updateProfile(userId, { avatar_url: data.url });
    return data.url;
  }

  /**
   * Remover avatar (Cloudflare R2)
   */
  static async deleteAvatar(userId: string, currentUrl: string | null): Promise<void> {
    if (!currentUrl) return;

    if (currentUrl.includes('media.lunarihub.com/')) {
      const storagePath = currentUrl.split('media.lunarihub.com/')[1];
      if (storagePath) {
        try {
          await supabase.functions.invoke('r2-delete', { body: { storagePath } });
        } catch (e) {
          console.warn('Falha ao remover avatar do R2:', e);
        }
      }
    } else {
      // Compatibilidade com avatares legados no Supabase Storage
      const urlParts = currentUrl.split('/avatars/');
      if (urlParts.length >= 2) {
        await supabase.storage.from('avatars').remove([urlParts[1]]);
      }
    }

    await this.updateProfile(userId, { avatar_url: null });
  }

  /**
   * Fazer upload de logo da empresa (Cloudflare R2)
   */
  static async uploadLogo(userId: string, file: File): Promise<string> {
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error('Tipo de arquivo inválido. Apenas JPG, PNG e WEBP são permitidos.');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Arquivo muito grande. Tamanho máximo: 5MB');
    }

    const current = await this.getProfile(userId);
    if (current?.logo_url && current.logo_url.includes('media.lunarihub.com/avatars/')) {
      const oldPath = current.logo_url.split('media.lunarihub.com/')[1];
      if (oldPath) {
        try {
          await supabase.functions.invoke('r2-delete', { body: { storagePath: oldPath } });
        } catch (e) {
          console.warn('Falha ao remover logo antigo:', e);
        }
      }
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('context', 'logo');

    const { data, error } = await supabase.functions.invoke('r2-upload', { body: formData });
    if (error) throw new Error(error.message || 'Erro no upload');
    if (!data?.success || !data?.url) throw new Error(data?.error || 'Upload falhou');

    await this.updateProfile(userId, { logo_url: data.url });
    return data.url;
  }

  /**
   * Remover logo (Cloudflare R2)
   */
  static async deleteLogo(userId: string, currentUrl: string | null): Promise<void> {
    if (!currentUrl) return;

    if (currentUrl.includes('media.lunarihub.com/')) {
      const storagePath = currentUrl.split('media.lunarihub.com/')[1];
      if (storagePath) {
        try {
          await supabase.functions.invoke('r2-delete', { body: { storagePath } });
        } catch (e) {
          console.warn('Falha ao remover logo do R2:', e);
        }
      }
    } else {
      const urlParts = currentUrl.split('/avatars/');
      if (urlParts.length >= 2) {
        await supabase.storage.from('avatars').remove([urlParts[1]]);
      }
    }

    await this.updateProfile(userId, { logo_url: null });
  }

  /**
   * Completar onboarding
   */
  static async completeOnboarding(
    userId: string, 
    data: { 
      nome: string; 
      nicho: string;
      cidade_ibge_id: number;
      cidade_nome: string;
      cidade_uf: string;
    }
  ): Promise<UserProfile> {
    return await this.updateProfile(userId, {
      nome: data.nome,
      nicho: data.nicho,
      cidade_ibge_id: data.cidade_ibge_id,
      cidade_nome: data.cidade_nome,
      cidade_uf: data.cidade_uf,
      cidade: `${data.cidade_nome} - ${data.cidade_uf}`, // Legacy compatibility
      is_onboarding_complete: true
    });
  }
}
