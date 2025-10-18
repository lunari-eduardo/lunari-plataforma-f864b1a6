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
   * Fazer upload de avatar
   */
  static async uploadAvatar(userId: string, file: File): Promise<string> {
    // Validate file type
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error('Tipo de arquivo inválido. Apenas JPG, PNG e WEBP são permitidos.');
    }

    // Validate file size (5MB max)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new Error('Arquivo muito grande. Tamanho máximo: 5MB');
    }

    // Sanitize file extension
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!fileExt || !['jpg', 'jpeg', 'png', 'webp'].includes(fileExt)) {
      throw new Error('Extensão de arquivo inválida');
    }

    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    // Upload do arquivo
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      console.error('Erro ao fazer upload:', uploadError);
      throw uploadError;
    }

    // Obter URL pública
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    // Atualizar perfil com a nova URL
    await this.updateProfile(userId, { avatar_url: data.publicUrl });

    return data.publicUrl;
  }

  /**
   * Remover avatar
   */
  static async deleteAvatar(userId: string, currentUrl: string | null): Promise<void> {
    if (!currentUrl) return;

    // Extrair o path do arquivo da URL
    const urlParts = currentUrl.split('/avatars/');
    if (urlParts.length < 2) return;

    const filePath = urlParts[1];

    // Deletar arquivo do storage
    const { error } = await supabase.storage
      .from('avatars')
      .remove([filePath]);

    if (error) {
      console.error('Erro ao deletar avatar:', error);
      throw error;
    }

    // Atualizar perfil removendo a URL
    await this.updateProfile(userId, { avatar_url: null });
  }

  /**
   * Completar onboarding
   */
  static async completeOnboarding(userId: string, data: { nome: string; cidade: string }): Promise<UserProfile> {
    return await this.updateProfile(userId, {
      nome: data.nome,
      cidade: data.cidade,
      is_onboarding_complete: true
    });
  }
}
