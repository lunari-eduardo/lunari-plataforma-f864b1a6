import { supabase } from '@/integrations/supabase/client';
import type {
  EstruturaCustosFixos,
  PadraoHoras,
  MetasPrecificacao,
  EstadoCalculadora,
  DadosValidacao
} from '@/types/precificacao';

export class SupabasePricingService {
  // ============= ESTRUTURA DE CUSTOS =============
  
  async saveEstruturaCustos(dados: EstruturaCustosFixos): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from('pricing_configs')
        .upsert({
          user_id: user.id,
          config_type: 'estrutura_custos',
          config_data: JSON.parse(JSON.stringify(dados))
        });

      return !error;
    } catch (error) {
      console.error('Error saving estrutura custos:', error);
      return false;
    }
  }

  async loadEstruturaCustos(): Promise<EstruturaCustosFixos> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return this.createDefaultEstruturaCustos();

      const { data, error } = await supabase
        .from('pricing_configs')
        .select('config_data')
        .eq('user_id', user.id)
        .eq('config_type', 'estrutura_custos')
        .maybeSingle();

      if (error || !data) {
        return this.createDefaultEstruturaCustos();
      }

      return data.config_data as any as EstruturaCustosFixos;
    } catch (error) {
      console.error('Error loading estrutura custos:', error);
      return this.createDefaultEstruturaCustos();
    }
  }

  // ============= PADRÃO DE HORAS =============
  
  async savePadraoHoras(dados: PadraoHoras): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from('pricing_configs')
        .upsert({
          user_id: user.id,
          config_type: 'padrao_horas',
          config_data: JSON.parse(JSON.stringify(dados))
        });

      return !error;
    } catch (error) {
      console.error('Error saving padrão horas:', error);
      return false;
    }
  }

  async loadPadraoHoras(): Promise<PadraoHoras> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return this.createDefaultPadraoHoras();

      const { data, error } = await supabase
        .from('pricing_configs')
        .select('config_data')
        .eq('user_id', user.id)
        .eq('config_type', 'padrao_horas')
        .maybeSingle();

      if (error || !data) {
        return this.createDefaultPadraoHoras();
      }

      return data.config_data as any as PadraoHoras;
    } catch (error) {
      console.error('Error loading padrão horas:', error);
      return this.createDefaultPadraoHoras();
    }
  }

  // ============= METAS =============
  
  async saveMetas(dados: MetasPrecificacao): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from('pricing_configs')
        .upsert({
          user_id: user.id,
          config_type: 'metas',
          config_data: JSON.parse(JSON.stringify(dados))
        });

      return !error;
    } catch (error) {
      console.error('Error saving metas:', error);
      return false;
    }
  }

  async loadMetas(): Promise<MetasPrecificacao> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return this.createDefaultMetas();

      const { data, error } = await supabase
        .from('pricing_configs')
        .select('config_data')
        .eq('user_id', user.id)
        .eq('config_type', 'metas')
        .maybeSingle();

      if (error || !data) {
        return this.createDefaultMetas();
      }

      return data.config_data as any as MetasPrecificacao;
    } catch (error) {
      console.error('Error loading metas:', error);
      return this.createDefaultMetas();
    }
  }

  // ============= CALCULADORA =============
  
  async saveCalculadora(dados: EstadoCalculadora): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from('pricing_configs')
        .upsert({
          user_id: user.id,
          config_type: 'calculadora',
          config_data: JSON.parse(JSON.stringify(dados))
        });

      return !error;
    } catch (error) {
      console.error('Error saving calculadora:', error);
      return false;
    }
  }

  async loadCalculadora(): Promise<EstadoCalculadora | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('pricing_configs')
        .select('config_data')
        .eq('user_id', user.id)
        .eq('config_type', 'calculadora')
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return data.config_data as any as EstadoCalculadora;
    } catch (error) {
      console.error('Error loading calculadora:', error);
      return null;
    }
  }

  async clearCalculadora(): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from('pricing_configs')
        .delete()
        .eq('user_id', user.id)
        .eq('config_type', 'calculadora');

      return !error;
    } catch (error) {
      console.error('Error clearing calculadora:', error);
      return false;
    }
  }

  // ============= VALIDAÇÃO =============
  
  async validateSystem(): Promise<DadosValidacao> {
    const estrutura = await this.loadEstruturaCustos();
    const padraoHoras = await this.loadPadraoHoras();
    const metas = await this.loadMetas();

    return {
      estruturaCustos: estrutura.totalCalculado > 0,
      padraoHoras: padraoHoras.horasDisponiveis > 0 && padraoHoras.diasTrabalhados > 0,
      metas: metas.margemLucroDesejada > 0,
      calculadora: true,
      ultimaValidacao: new Date().toISOString()
    };
  }

  // ============= BACKUP =============
  
  async exportData(): Promise<string> {
    const estrutura = await this.loadEstruturaCustos();
    const padraoHoras = await this.loadPadraoHoras();
    const metas = await this.loadMetas();
    const calculadora = await this.loadCalculadora();

    const exportData = {
      estruturaCustos: estrutura,
      padraoHoras,
      metas,
      calculadora,
      exportedAt: new Date().toISOString()
    };

    return JSON.stringify(exportData, null, 2);
  }

  async importData(data: string): Promise<boolean> {
    try {
      const parsedData = JSON.parse(data);
      
      if (parsedData.estruturaCustos) {
        await this.saveEstruturaCustos(parsedData.estruturaCustos);
      }
      
      if (parsedData.padraoHoras) {
        await this.savePadraoHoras(parsedData.padraoHoras);
      }
      
      if (parsedData.metas) {
        await this.saveMetas(parsedData.metas);
      }
      
      if (parsedData.calculadora) {
        await this.saveCalculadora(parsedData.calculadora);
      }

      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  }

  // ============= DEFAULT DATA CREATORS =============
  
  private createDefaultEstruturaCustos(): EstruturaCustosFixos {
    return {
      gastosPessoais: [],
      percentualProLabore: 0,
      custosEstudio: [],
      equipamentos: [],
      totalCalculado: 0
    };
  }

  private createDefaultPadraoHoras(): PadraoHoras {
    return {
      horasDisponiveis: 40,
      diasTrabalhados: 5
    };
  }

  private createDefaultMetas(): MetasPrecificacao {
    return {
      margemLucroDesejada: 30,
      ano: new Date().getFullYear(),
      metaFaturamentoAnual: 0,
      metaLucroAnual: 0
    };
  }
}

export const supabasePricingService = new SupabasePricingService();