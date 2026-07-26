import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { ProfileService, UserProfile as SupabaseProfile } from '@/services/ProfileService';
import { UserBranding, UserPreferences, DEFAULT_USER_BRANDING, DEFAULT_USER_PREFERENCES } from '@/types/userProfile';
import { UserDataService } from '@/services/UserDataService';
import { supabase } from '@/integrations/supabase/client';
import { isAuthError } from '@/lib/auth/isAuthError';

// Singleton por usuário — evita canais duplicados de 'profile-changes'.
// Sem isso, múltiplos consumidores de useUserProfile (ProtectedRoute, Header,
// DashboardHeader, contratos, etc.) reutilizavam o mesmo tópico global já
// SUBSCRIBED e o segundo .on('postgres_changes') lançava
// "cannot add 'postgres_changes' callbacks ... after subscribe()", derrubando
// a árvore React (tela branca no boot).
type ProfileHandler = (row: unknown) => void;
type ProfileChannelEntry = {
  channel: ReturnType<typeof supabase.channel>;
  handlers: Set<ProfileHandler>;
  refcount: number;
};
const profileChannels = new Map<string, ProfileChannelEntry>();

function subscribeProfileChanges(userId: string, handler: ProfileHandler): () => void {
  let entry = profileChannels.get(userId);
  if (!entry) {
    const handlers = new Set<ProfileHandler>();
    const channel = supabase
      .channel(`profile-changes:${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `user_id=eq.${userId}` },
        (payload) => handlers.forEach((h) => h(payload.new)),
      )
      .subscribe();
    entry = { channel, handlers, refcount: 0 };
    profileChannels.set(userId, entry);
  }
  entry.handlers.add(handler);
  entry.refcount += 1;

  return () => {
    const e = profileChannels.get(userId);
    if (!e) return;
    e.handlers.delete(handler);
    e.refcount -= 1;
    if (e.refcount <= 0) {
      supabase.removeChannel(e.channel);
      profileChannels.delete(userId);
    }
  };
}

export function useUserProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Query para buscar perfil.
  // IMPORTANTE: NÃO criamos mais perfil vazio aqui. A criação inicial é
  // responsabilidade exclusiva do fluxo `/onboarding` (com dados reais).
  // Auto-criar vazio aqui causava regressão do `is_onboarding_complete`
  // sempre que a query rodava durante uma transient 401 (ex.: race de
  // refresh de JWT no boot do app), jogando o usuário no /onboarding.
  const { data: profile, isLoading: loading, isError: isProfileError } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      return ProfileService.getProfile(user.id);
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    // Retry quando o erro for de auth (JWT expirado durante boot) — o
    // singleton ensureFreshSession garante 1 refresh por vez.
    retry: (count, err) => isAuthError(err) && count < 3,
    retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000),
  });

  // Mutation para atualizar perfil
  const updateProfileMutation = useMutation({
    mutationFn: (data: Partial<Omit<SupabaseProfile, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => 
      ProfileService.updateProfile(user!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      toast.success('Perfil atualizado com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao atualizar perfil:', error);
      toast.error('Erro ao atualizar perfil');
    }
  });

  // Subscription realtime (singleton por usuário, refcount).
  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    return subscribeProfileChanges(uid, (row) => {
      queryClient.setQueryData(['profile', uid], row);
    });
  }, [user?.id, queryClient]);


  const uploadAvatar = async (file: File) => {
    if (!user) throw new Error('Usuário não autenticado');
    try {
      const avatarUrl = await ProfileService.uploadAvatar(user.id, file);
      queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
      toast.success('Foto atualizada com sucesso!');
      return avatarUrl;
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast.error('Erro ao fazer upload da foto');
      throw error;
    }
  };

  const deleteAvatar = async () => {
    if (!user) throw new Error('Usuário não autenticado');
    try {
      await ProfileService.deleteAvatar(user.id, profile?.avatar_url || null);
      queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
      toast.success('Foto removida com sucesso!');
    } catch (error) {
      console.error('Erro ao remover foto:', error);
      toast.error('Erro ao remover foto');
      throw error;
    }
  };

  const uploadLogo = async (file: File) => {
    if (!user) throw new Error('Usuário não autenticado');
    try {
      const logoUrl = await ProfileService.uploadLogo(user.id, file);
      queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
      toast.success('Logo atualizado com sucesso!');
      return logoUrl;
    } catch (error) {
      console.error('Erro ao fazer upload do logo:', error);
      toast.error('Erro ao fazer upload do logo');
      throw error;
    }
  };

  const deleteLogo = async () => {
    if (!user) throw new Error('Usuário não autenticado');
    try {
      await ProfileService.deleteLogo(user.id, profile?.logo_url || null);
      queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
      toast.success('Logo removido com sucesso!');
    } catch (error) {
      console.error('Erro ao remover logo:', error);
      toast.error('Erro ao remover logo');
      throw error;
    }
  };

  const getProfileOrDefault = (): SupabaseProfile => {
    if (profile) return profile;
    
    const now = new Date().toISOString();
    return {
      id: '',
      user_id: user?.id || '',
      nome: null,
      email: null,
      telefone: null,
      cidade: null,
      empresa: null,
      logo_url: null,
      avatar_url: null,
      cpf_cnpj: null,
      endereco_comercial: null,
      telefones: null,
      site_redes_sociais: null,
      is_onboarding_complete: false,
      nicho: null,
      cidade_ibge_id: null,
      cidade_nome: null,
      cidade_uf: null,
      created_at: now,
      updated_at: now
    };
  };

  return {
    profile,
    loading,
    isProfileError,
    updateProfile: updateProfileMutation.mutate,
    updateProfileAsync: updateProfileMutation.mutateAsync,
    saveProfile: updateProfileMutation.mutate, // Alias for compatibility
    uploadAvatar,
    deleteAvatar,
    uploadLogo,
    deleteLogo,
    getProfileOrDefault
  };
}

export function useUserBranding() {
  const [branding, setBranding] = useState<UserBranding | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBranding();
  }, []);

  const loadBranding = () => {
    try {
      const savedBranding = UserDataService.loadBranding();
      setBranding(savedBranding);
    } catch (error) {
      console.error('Erro ao carregar branding:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveBranding = async (brandingData: Partial<Omit<UserBranding, 'id' | 'createdAt' | 'updatedAt'>>) => {
    try {
      const updatedBranding = await UserDataService.saveBranding(brandingData);
      setBranding(updatedBranding);
      return true;
    } catch (error) {
      console.error('Erro ao salvar branding:', error);
      toast.error('Erro ao salvar branding');
      return false;
    }
  };

  const removeLogo = () => {
    const success = saveBranding({ logoUrl: undefined, logoFileName: undefined });
    if (success) {
      toast.success('Logo removido com sucesso!');
    }
  };

  const getBrandingOrDefault = (): UserBranding => {
    if (branding) return branding;
    
    const now = new Date().toISOString();
    return {
      ...DEFAULT_USER_BRANDING,
      id: `branding_${Date.now()}`,
      createdAt: now,
      updatedAt: now
    };
  };

  return {
    branding,
    loading,
    saveBranding,
    loadBranding,
    removeLogo,
    getBrandingOrDefault
  };
}

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = () => {
    try {
      const savedPrefs = UserDataService.loadPreferences();
      setPreferences(savedPrefs);
    } catch (error) {
      console.error('Erro ao carregar preferências:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async (preferencesData: Partial<Omit<UserPreferences, 'id' | 'createdAt' | 'updatedAt'>>) => {
    try {
      const updatedPreferences = await UserDataService.savePreferences(preferencesData);
      setPreferences(updatedPreferences);
      return true;
    } catch (error) {
      console.error('Erro ao salvar preferências:', error);
      toast.error('Erro ao salvar preferências');
      return false;
    }
  };

  const getPreferencesOrDefault = (): UserPreferences => {
    if (preferences) return preferences;
    
    const now = new Date().toISOString();
    return {
      ...DEFAULT_USER_PREFERENCES,
      id: `preferences_${Date.now()}`,
      createdAt: now,
      updatedAt: now
    };
  };

  return {
    preferences,
    loading,
    savePreferences,
    loadPreferences,
    getPreferencesOrDefault
  };
}