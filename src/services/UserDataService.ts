// Service para gerenciar dados do usuário de forma consistente
// Preparado para integração futura com Supabase

import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import { UserProfile, UserBranding, UserPreferences } from '@/types/userProfile';

export interface UserDataSync {
  lastSyncAt?: string;
  source: 'localStorage' | 'supabase';
  conflicts?: string[];
}

export class UserDataService {
  // Prefixo para identificar dados locais vs remotos
  private static readonly LOCAL_PREFIX = 'local_';
  private static readonly SYNC_SUFFIX = '_sync';

  // Profile Operations
  static async saveProfile(profileData: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserProfile> {
    const now = new Date().toISOString();
    const existingProfile = this.loadProfile();
    
    const profile: UserProfile = {
      ...profileData,
      id: existingProfile?.id || `${this.LOCAL_PREFIX}profile_${Date.now()}`,
      createdAt: existingProfile?.createdAt || now,
      updatedAt: now
    };

    // Salva o perfil
    storage.save(STORAGE_KEYS.USER_PROFILE, profile);
    
    // Salva metadados de sincronização
    const syncData: UserDataSync = {
      lastSyncAt: now,
      source: 'localStorage'
    };
    storage.save(STORAGE_KEYS.USER_PROFILE + this.SYNC_SUFFIX, syncData);

    console.log('✅ UserDataService: Perfil salvo:', profile.id);
    return profile;
  }

  static loadProfile(): UserProfile | null {
    try {
      const profile = storage.load<UserProfile | null>(STORAGE_KEYS.USER_PROFILE, null);
      if (profile) {
        console.log('✅ UserDataService: Perfil carregado:', profile.id);
      } else {
        console.log('ℹ️ UserDataService: Nenhum perfil encontrado');
      }
      return profile;
    } catch (error) {
      console.error('❌ UserDataService: Erro ao carregar perfil:', error);
      return null;
    }
  }

  // Branding Operations
  static async saveBranding(brandingData: Partial<Omit<UserBranding, 'id' | 'createdAt' | 'updatedAt'>>): Promise<UserBranding> {
    const now = new Date().toISOString();
    const existingBranding = this.loadBranding();
    
    const branding: UserBranding = {
      logoUrl: undefined,
      logoFileName: undefined,
      ...existingBranding,
      ...brandingData,
      id: existingBranding?.id || `${this.LOCAL_PREFIX}branding_${Date.now()}`,
      createdAt: existingBranding?.createdAt || now,
      updatedAt: now
    };

    storage.save(STORAGE_KEYS.USER_BRANDING, branding);
    
    const syncData: UserDataSync = {
      lastSyncAt: now,
      source: 'localStorage'
    };
    storage.save(STORAGE_KEYS.USER_BRANDING + this.SYNC_SUFFIX, syncData);

    console.log('✅ UserDataService: Branding salvo:', branding.id);
    return branding;
  }

  static loadBranding(): UserBranding | null {
    try {
      return storage.load<UserBranding | null>(STORAGE_KEYS.USER_BRANDING, null);
    } catch (error) {
      console.error('❌ UserDataService: Erro ao carregar branding:', error);
      return null;
    }
  }

  // Preferences Operations
  static async savePreferences(preferencesData: Partial<Omit<UserPreferences, 'id' | 'createdAt' | 'updatedAt'>>): Promise<UserPreferences> {
    const now = new Date().toISOString();
    const existingPrefs = this.loadPreferences();
    
    const preferences: UserPreferences = {
      notificacoesWhatsapp: true,
      habilitarAutomacoesWorkflow: true,
      habilitarAlertaProdutosDoCliente: true,
      regimeTributario: 'mei',
      ...existingPrefs,
      ...preferencesData,
      id: existingPrefs?.id || `${this.LOCAL_PREFIX}preferences_${Date.now()}`,
      createdAt: existingPrefs?.createdAt || now,
      updatedAt: now
    };

    storage.save(STORAGE_KEYS.USER_PREFERENCES, preferences);
    
    const syncData: UserDataSync = {
      lastSyncAt: now,
      source: 'localStorage'
    };
    storage.save(STORAGE_KEYS.USER_PREFERENCES + this.SYNC_SUFFIX, syncData);

    console.log('✅ UserDataService: Preferências salvas:', preferences.id);
    return preferences;
  }

  static loadPreferences(): UserPreferences | null {
    try {
      return storage.load<UserPreferences | null>(STORAGE_KEYS.USER_PREFERENCES, null);
    } catch (error) {
      console.error('❌ UserDataService: Erro ao carregar preferências:', error);
      return null;
    }
  }

  // Utility Methods
  static async exportAllUserData(): Promise<{
    profile: UserProfile | null;
    branding: UserBranding | null;
    preferences: UserPreferences | null;
    syncInfo: Record<string, UserDataSync>;
  }> {
    const profile = this.loadProfile();
    const branding = this.loadBranding();
    const preferences = this.loadPreferences();

    const syncInfo = {
      profile: storage.load<UserDataSync>(`${STORAGE_KEYS.USER_PROFILE}${this.SYNC_SUFFIX}`, { source: 'localStorage' } as UserDataSync),
      branding: storage.load<UserDataSync>(`${STORAGE_KEYS.USER_BRANDING}${this.SYNC_SUFFIX}`, { source: 'localStorage' } as UserDataSync),
      preferences: storage.load<UserDataSync>(`${STORAGE_KEYS.USER_PREFERENCES}${this.SYNC_SUFFIX}`, { source: 'localStorage' } as UserDataSync)
    };

    return { profile, branding, preferences, syncInfo };
  }

  static clearAllUserData(): void {
    try {
      // Remove dados principais
      storage.remove(STORAGE_KEYS.USER_PROFILE);
      storage.remove(STORAGE_KEYS.USER_BRANDING);
      storage.remove(STORAGE_KEYS.USER_PREFERENCES);
      
      // Remove metadados de sincronização
      storage.remove(STORAGE_KEYS.USER_PROFILE + this.SYNC_SUFFIX);
      storage.remove(STORAGE_KEYS.USER_BRANDING + this.SYNC_SUFFIX);
      storage.remove(STORAGE_KEYS.USER_PREFERENCES + this.SYNC_SUFFIX);
      
      console.log('✅ UserDataService: Todos os dados do usuário foram limpos');
    } catch (error) {
      console.error('❌ UserDataService: Erro ao limpar dados:', error);
    }
  }

  // Preparação para Supabase
  static async prepareForSupabaseSync(): Promise<{
    needsSync: boolean;
    data: {
      profile: UserProfile | null;
      branding: UserBranding | null;
      preferences: UserPreferences | null;
    };
  }> {
    const { profile, branding, preferences } = await this.exportAllUserData();
    
    // Verifica se existem dados locais que precisam ser sincronizados
    const needsSync = !!(profile || branding || preferences);
    
    return {
      needsSync,
      data: { profile, branding, preferences }
    };
  }
}