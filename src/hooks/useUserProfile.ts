import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { ProfileService, UserProfile as SupabaseProfile } from '@/services/ProfileService';
import { UserBranding, UserPreferences, DEFAULT_USER_BRANDING, DEFAULT_USER_PREFERENCES } from '@/types/userProfile';
import { UserDataService } from '@/services/UserDataService';
import { supabase } from '@/integrations/supabase/client';

export function useUserProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Query para buscar perfil (com criação automática se não existir)
  const { data: profile, isLoading: loading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      let userProfile = await ProfileService.getProfile(user.id);
      
      // Se perfil não existe, criar um básico
      if (!userProfile) {
        userProfile = await ProfileService.updateProfile(user.id, {
          email: user.email || '',
          nome: '',
          cidade: '',
          is_onboarding_complete: false
        });
      }
      
      return userProfile;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5 // 5 minutos
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

  // Subscription para mudanças em tempo real
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          queryClient.setQueryData(['profile', user.id], payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

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
      created_at: now,
      updated_at: now
    };
  };

  return {
    profile,
    loading,
    updateProfile: updateProfileMutation.mutate,
    saveProfile: updateProfileMutation.mutate, // Alias for compatibility
    uploadAvatar,
    deleteAvatar,
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