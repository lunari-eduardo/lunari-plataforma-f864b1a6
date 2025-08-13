import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import { UserProfile, UserBranding, UserPreferences, DEFAULT_USER_PROFILE, DEFAULT_USER_BRANDING, DEFAULT_USER_PREFERENCES } from '@/types/userProfile';

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = () => {
    try {
      const savedProfile = storage.load<UserProfile | null>(STORAGE_KEYS.USER_PROFILE, null);
      setProfile(savedProfile);
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = (profileData: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const now = new Date().toISOString();
      const updatedProfile: UserProfile = {
        ...profileData,
        id: profile?.id || `profile_${Date.now()}`,
        createdAt: profile?.createdAt || now,
        updatedAt: now
      };

      storage.save(STORAGE_KEYS.USER_PROFILE, updatedProfile);
      setProfile(updatedProfile);
      toast.success('Perfil salvo com sucesso!');
      return true;
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
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
      const savedBranding = storage.load<UserBranding | null>(STORAGE_KEYS.USER_BRANDING, null);
      setBranding(savedBranding);
    } catch (error) {
      console.error('Erro ao carregar branding:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveBranding = (brandingData: Partial<Omit<UserBranding, 'id' | 'createdAt' | 'updatedAt'>>) => {
    try {
      const now = new Date().toISOString();
      const updatedBranding: UserBranding = {
        ...DEFAULT_USER_BRANDING,
        ...branding,
        ...brandingData,
        id: branding?.id || `branding_${Date.now()}`,
        createdAt: branding?.createdAt || now,
        updatedAt: now
      };

      storage.save(STORAGE_KEYS.USER_BRANDING, updatedBranding);
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
      const savedPrefs = storage.load<UserPreferences | null>(STORAGE_KEYS.USER_PREFERENCES, null);
      setPreferences(savedPrefs);
    } catch (error) {
      console.error('Erro ao carregar preferências:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = (preferencesData: Partial<Omit<UserPreferences, 'id' | 'createdAt' | 'updatedAt'>>) => {
    try {
      const now = new Date().toISOString();
      const base = preferences ?? (storage.load<UserPreferences | null>(STORAGE_KEYS.USER_PREFERENCES, null) ?? null);
      const updatedPreferences: UserPreferences = {
        ...DEFAULT_USER_PREFERENCES,
        ...(base ? base : {}),
        ...preferencesData,
        id: base?.id || preferences?.id || `preferences_${Date.now()}`,
        createdAt: base?.createdAt || preferences?.createdAt || now,
        updatedAt: now
      };

      storage.save(STORAGE_KEYS.USER_PREFERENCES, updatedPreferences);
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