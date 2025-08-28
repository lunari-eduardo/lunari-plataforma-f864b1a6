import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { UserProfile, UserBranding, UserPreferences, DEFAULT_USER_PROFILE, DEFAULT_USER_BRANDING, DEFAULT_USER_PREFERENCES } from '@/types/userProfile';
import { UserDataService } from '@/services/UserDataService';

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = () => {
    try {
      const savedProfile = UserDataService.loadProfile();
      setProfile(savedProfile);
    } catch (error) {
      console.error('❌ Erro ao carregar perfil:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async (profileData: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const updatedProfile = await UserDataService.saveProfile(profileData);
      setProfile(updatedProfile);
      toast.success('Perfil salvo com sucesso!');
      return true;
    } catch (error) {
      console.error('❌ Erro ao salvar perfil:', error);
      toast.error('Erro ao salvar perfil');
      return false;
    }
  };

  const getProfileOrDefault = (): UserProfile => {
    if (profile) return profile;
    
    const now = new Date().toISOString();
    return {
      ...DEFAULT_USER_PROFILE,
      id: `profile_${Date.now()}`,
      createdAt: now,
      updatedAt: now
    };
  };

  return {
    profile,
    loading,
    saveProfile,
    loadProfile,
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