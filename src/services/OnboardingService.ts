import { supabase } from '@/integrations/supabase/client';
import { ProfileService, UserProfile } from '@/services/ProfileService';
import { CONTRATO_SEED_TEMPLATES } from '@/utils/contratoSeedTemplates';
import { FORMULARIO_SEED_TEMPLATES } from '@/utils/formularioSeedTemplates';
import { PricingCalculationService } from '@/services/PricingCalculationService';

export interface UserOnboardingState {
  user_id: string;
  current_step: number;
  completed_steps: number[];
  status: 'in_progress' | 'completed' | 'skipped';
  data: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface BusinessData {
  nome: string;
  cidade: string;
  cidade_nome?: string;
  cidade_uf?: string;
  cidade_ibge_id?: number | null;
  instagram?: string;
  whatsapp?: string;
}

export interface PhotographyTypesData {
  mainNiche?: string | null;
  categories: string[];
}

export interface BrandData {
  logoUrl?: string | null;
  brandName: string;
  instagram?: string;
  brandColor: string;
}

export type PricingModelChoice = 'fixo' | 'global' | 'categoria';

const DEFAULT_CATEGORY_COLORS = [
  '#C6A36A', // Dourado Lunari
  '#C86D51', // Terracota
  '#7A9A8B', // Verde Sálvia
  '#4A6B82', // Azul Clássico
  '#9B7E6B', // Capuccino
  '#C99B9B', // Nude Rose
  '#687F90', // Ardósia
  '#A37C58', // Âmbar
  '#8E6C8A', // Lavanda Antigo
  '#5C7872', // Eucalipto
];

const normalizeText = (s?: string | null) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

export class OnboardingService {
  /**
   * Carrega o estado persistente do onboarding do usuário
   */
  static async getOnboardingState(userId: string): Promise<UserOnboardingState | null> {
    try {
      const { data, error } = await supabase
        .from('user_onboarding_state' as any)
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Erro ao carregar estado do onboarding:', error);
        return null;
      }

      return data as unknown as UserOnboardingState;
    } catch (e) {
      console.warn('Falha ao buscar user_onboarding_state:', e);
      return null;
    }
  }

  /**
   * Salva o estado persistente do onboarding
   */
  static async saveOnboardingState(
    userId: string,
    updates: Partial<Omit<UserOnboardingState, 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<void> {
    try {
      const existing = await this.getOnboardingState(userId);
      const mergedCompleted = updates.completed_steps || existing?.completed_steps || [];
      const currentStep = updates.current_step !== undefined ? updates.current_step : existing?.current_step ?? 0;
      const status = updates.status || existing?.status || 'in_progress';
      const data = { ...(existing?.data || {}), ...(updates.data || {}) };

      const { error } = await supabase
        .from('user_onboarding_state' as any)
        .upsert(
          {
            user_id: userId,
            current_step: currentStep,
            completed_steps: Array.from(new Set(mergedCompleted)),
            status,
            data,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

      if (error) {
        console.error('Erro ao salvar user_onboarding_state:', error);
      }
    } catch (e) {
      console.error('Falha ao salvar user_onboarding_state:', e);
    }
  }

  /**
   * Etapa 1: Salva as informações reais do negócio no perfil do usuário
   */
  static async saveBusinessProfile(userId: string, data: BusinessData): Promise<UserProfile> {
    const instagramSanitized = (data.instagram || '').trim();
    const whatsappSanitized = (data.whatsapp || '').trim();

    const siteRedes = instagramSanitized ? [instagramSanitized] : [];
    const telefones = whatsappSanitized ? [whatsappSanitized] : [];

    return await ProfileService.updateProfile(userId, {
      nome: data.nome.trim(),
      empresa: data.nome.trim(),
      cidade: data.cidade.trim(),
      cidade_nome: data.cidade_nome || data.cidade.trim(),
      cidade_uf: data.cidade_uf || null,
      cidade_ibge_id: data.cidade_ibge_id || null,
      telefone: whatsappSanitized || null,
      telefones: telefones.length > 0 ? telefones : null,
      site_redes_sociais: siteRedes.length > 0 ? siteRedes : null,
    });
  }

  /**
   * Etapa 2: Salva nicho principal e categorias reais da conta de forma idempotente
   */
  static async savePhotographyTypes(
    userId: string,
    types: PhotographyTypesData
  ): Promise<void> {
    // 1. Salvar nicho principal no perfil
    const nichoPrincipal = types.mainNiche && types.mainNiche !== 'none' ? types.mainNiche : null;
    await ProfileService.updateProfile(userId, {
      nicho: nichoPrincipal,
    });

    if (!types.categories || types.categories.length === 0) return;

    // 2. Buscar categorias existentes para evitar duplicações
    const { data: existingCats, error: fetchErr } = await supabase
      .from('categorias')
      .select('id, nome')
      .eq('user_id', userId);

    if (fetchErr) throw fetchErr;

    const existingNames = new Set((existingCats || []).map((c) => normalizeText(c.nome)));
    const categoriesToCreate: Array<{
      user_id: string;
      nome: string;
      cor: string;
      created_at: string;
      updated_at: string;
    }> = [];

    const now = new Date().toISOString();

    types.categories.forEach((catName, index) => {
      const normalized = normalizeText(catName);
      if (normalized && !existingNames.has(normalized)) {
        existingNames.add(normalized);
        const color = DEFAULT_CATEGORY_COLORS[index % DEFAULT_CATEGORY_COLORS.length];
        categoriesToCreate.push({
          user_id: userId,
          nome: catName.trim(),
          cor: color,
          created_at: now,
          updated_at: now,
        });
      }
    });

    if (categoriesToCreate.length > 0) {
      const { error: insertErr } = await supabase
        .from('categorias')
        .insert(categoriesToCreate);

      if (insertErr) {
        console.error('Erro ao inserir categorias:', insertErr);
        throw insertErr;
      }
    }
  }

  /**
   * Etapa 3: Cria templates de contratos reais na conta do usuário
   */
  static async seedContracts(userId: string, selectedSlugs: string[]): Promise<number> {
    if (!selectedSlugs || selectedSlugs.length === 0) return 0;

    // Buscar contratos já existentes do usuário
    const { data: existingTemplates, error: fetchErr } = await supabase
      .from('contrato_templates')
      .select('id, nome, categoria')
      .eq('user_id', userId);

    if (fetchErr) throw fetchErr;

    const existingCategories = new Set(
      (existingTemplates || []).map((t) => normalizeText(t.categoria))
    );
    const existingNames = new Set(
      (existingTemplates || []).map((t) => normalizeText(t.nome))
    );

    const templatesToInsert = CONTRATO_SEED_TEMPLATES
      .filter((seed) => selectedSlugs.includes(seed.slug))
      .filter(
        (seed) =>
          !existingCategories.has(normalizeText(seed.categoria)) &&
          !existingNames.has(normalizeText(seed.nome))
      )
      .map((seed) => ({
        user_id: userId,
        nome: seed.nome,
        descricao: seed.descricao,
        categoria: seed.categoria,
        conteudo: seed.conteudo,
        is_padrao: false,
      }));

    if (templatesToInsert.length === 0) return 0;

    const { error: insertErr } = await supabase
      .from('contrato_templates')
      .insert(templatesToInsert);

    if (insertErr) {
      console.error('Erro ao criar modelos de contratos:', insertErr);
      throw insertErr;
    }

    return templatesToInsert.length;
  }

  /**
   * Etapa 4: Cria formulários reais na conta do usuário (formulario_templates)
   */
  static async seedForms(userId: string, selectedSlugs: string[]): Promise<number> {
    if (!selectedSlugs || selectedSlugs.length === 0) return 0;

    const { data: existingForms, error: fetchErr } = await supabase
      .from('formulario_templates')
      .select('id, nome, categoria')
      .eq('user_id', userId);

    if (fetchErr) throw fetchErr;

    const existingNames = new Set((existingForms || []).map((f) => normalizeText(f.nome)));
    const existingCategories = new Set((existingForms || []).map((f) => normalizeText(f.categoria)));

    const formsToInsert = FORMULARIO_SEED_TEMPLATES
      .filter((seed) => selectedSlugs.includes(seed.slug))
      .filter(
        (seed) =>
          !existingNames.has(normalizeText(seed.nome)) &&
          !existingCategories.has(normalizeText(seed.categoria))
      )
      .map((seed) => ({
        user_id: userId,
        nome: seed.nome,
        categoria: seed.categoria,
        descricao: seed.descricao,
        campos: seed.campos as unknown as any,
        tempo_estimado: seed.tempo_estimado,
        is_system: false,
      }));

    if (formsToInsert.length === 0) return 0;

    const { error: insertErr } = await supabase
      .from('formulario_templates')
      .insert(formsToInsert);

    if (insertErr) {
      console.error('Erro ao criar modelos de formulários:', insertErr);
      throw insertErr;
    }

    return formsToInsert.length;
  }

  /**
   * Etapa 5: Salva a identidade visual (Logo, Nome da Marca, Cor Primária)
   */
  static async saveBrandIdentity(userId: string, brand: BrandData): Promise<void> {
    const cleanBrandName = (brand.brandName || '').trim();
    const cleanInstagram = (brand.instagram || '').trim();
    const brandColor = brand.brandColor || '#C6A36A';

    // 1. Atualizar perfil com nome da empresa e instagram
    const profileUpdates: Partial<UserProfile> = {};
    if (cleanBrandName) {
      profileUpdates.empresa = cleanBrandName;
    }
    if (cleanInstagram) {
      profileUpdates.site_redes_sociais = [cleanInstagram];
    }
    if (brand.logoUrl !== undefined) {
      profileUpdates.logo_url = brand.logoUrl;
    }

    if (Object.keys(profileUpdates).length > 0) {
      await ProfileService.updateProfile(userId, profileUpdates);
    }

    // 2. Salvar configurações de galeria e tema com a cor escolhida
    const { data: themeData, error: themeErr } = await supabase
      .from('gallery_themes')
      .upsert(
        {
          user_id: userId,
          name: cleanBrandName || 'Marca',
          background_mode: 'light',
          primary_color: brandColor,
          accent_color: brandColor,
          emphasis_color: brandColor,
        },
        { onConflict: 'user_id' }
      )
      .select('id')
      .single();

    if (themeErr) {
      console.warn('Erro ao salvar gallery_themes:', themeErr);
    }

    const { error: settingsErr } = await supabase
      .from('gallery_settings')
      .upsert(
        {
          user_id: userId,
          studio_name: cleanBrandName || 'Meu Estúdio',
          studio_logo_url: brand.logoUrl || null,
          theme_type: 'custom',
          active_theme_id: themeData?.id || null,
        },
        { onConflict: 'user_id' }
      );

    if (settingsErr) {
      console.warn('Erro ao salvar gallery_settings:', settingsErr);
    }
  }

  /**
   * Etapa 6: Salva o modelo de precificação de fotos extras
   */
  static async savePricingModel(userId: string, model: PricingModelChoice): Promise<void> {
    // 1. Salvar modelo na tabela `modelo_de_preco`
    const { error: modelErr } = await supabase
      .from('modelo_de_preco')
      .upsert(
        {
          user_id: userId,
          modelo: model,
        },
        { onConflict: 'user_id' }
      );

    if (modelErr) throw modelErr;

    // 2. Se for modelo global, garantir que exista uma tabela padrão
    if (model === 'global') {
      const { data: existingTable } = await supabase
        .from('tabelas_precos')
        .select('id')
        .eq('user_id', userId)
        .eq('tipo', 'global')
        .maybeSingle();

      if (!existingTable) {
        const defaultTable = PricingCalculationService.criarTabelaExemplo();
        await supabase.from('tabelas_precos').insert({
          id: defaultTable.id || crypto.randomUUID(),
          user_id: userId,
          nome: defaultTable.nome || 'Tabela Progressiva Padrão',
          tipo: 'global',
          categoria_id: null,
          faixas: defaultTable.faixas as any,
          usar_valor_fixo_pacote: false,
        });
      }
    }
  }

  /**
   * Finalização: Conclui o onboarding e inicia o trial
   */
  static async completeOnboarding(userId: string): Promise<void> {
    // 1. Marcar perfil como completo
    await ProfileService.updateProfile(userId, {
      is_onboarding_complete: true,
    });

    // 2. Disparar trial do Studio
    try {
      const { error: trialError } = await supabase.rpc('start_studio_trial');
      if (trialError) console.warn('Erro ao iniciar trial:', trialError);
    } catch (e) {
      console.warn('Falha no RPC start_studio_trial:', e);
    }

    // 3. Atualizar user_onboarding_state
    await this.saveOnboardingState(userId, {
      status: 'completed',
      current_step: 7,
    });
  }

  /**
   * Adiar Onboarding ("Configurar depois")
   */
  static async skipOnboarding(userId: string): Promise<void> {
    // Marca como skipped no estado para liberar acesso
    await this.saveOnboardingState(userId, {
      status: 'skipped',
    });

    // Garante que o trial também seja ativado caso o usuário decida explorar
    try {
      await supabase.rpc('start_studio_trial');
    } catch {}
  }
}
