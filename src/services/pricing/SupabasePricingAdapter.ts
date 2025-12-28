/**
 * Supabase Implementation for Pricing System
 * Full Supabase integration with multi-user support
 */

import { supabase } from '@/integrations/supabase/client';
import type { PricingStorageAdapter, StorageConfig } from './PricingStorageAdapter';
import type {
  EstruturaCustosFixos,
  PadraoHoras,
  MetasPrecificacao,
  EstadoCalculadora,
  DadosValidacao,
  GastoItem,
  Equipamento
} from '@/types/precificacao';

export class SupabasePricingAdapter implements PricingStorageAdapter {
  private config: StorageConfig;
  private userId: string | null = null;

  constructor(config: StorageConfig = {}) {
    this.config = {
      enableAutoSave: true,
      validationInterval: 30000,
      ...config
    };
  }

  private async ensureUser(): Promise<string> {
    if (this.userId) return this.userId;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');
    
    this.userId = user.id;
    return user.id;
  }

  // ============= ESTRUTURA DE CUSTOS =============
  
  async saveEstruturaCustos(dados: EstruturaCustosFixos): Promise<boolean> {
    try {
      const userId = await this.ensureUser();
      console.log('💾 Salvando estrutura de custos para user:', userId);
      console.log('📊 Dados:', {
        percentualProLabore: dados.percentualProLabore,
        gastosPessoais: dados.gastosPessoais?.length,
        custosEstudio: dados.custosEstudio?.length,
        equipamentos: dados.equipamentos?.length
      });
      
      // 1. Upsert configurações (pró-labore)
      const { error: configError } = await supabase
        .from('pricing_configuracoes')
        .upsert({
          user_id: userId,
          percentual_pro_labore: dados.percentualProLabore
        }, { onConflict: 'user_id' });
      
      if (configError) {
        console.error('❌ Erro ao salvar pró-labore:', configError);
        throw configError;
      }
      console.log('✅ Pró-labore salvo:', dados.percentualProLabore);
      
      // 2. Sincronizar gastos pessoais
      await this.syncGastosPessoais(userId, dados.gastosPessoais);
      
      // 3. Sincronizar custos de estúdio
      await this.syncCustosEstudio(userId, dados.custosEstudio);
      
      // 4. Sincronizar equipamentos
      await this.syncEquipamentos(userId, dados.equipamentos);
      
      console.log('✅ Estrutura de custos salva no Supabase');
      return true;
      
    } catch (error) {
      console.error('❌ Erro ao salvar estrutura de custos:', error);
      return false;
    }
  }

  private async syncGastosPessoais(userId: string, gastos: GastoItem[]): Promise<void> {
    console.log('🔄 Sincronizando gastos pessoais:', gastos?.length || 0);
    
    // Estratégia: delete-all + insert-all (mais confiável que upsert)
    const { error: deleteError } = await supabase
      .from('pricing_gastos_pessoais')
      .delete()
      .eq('user_id', userId);
    
    if (deleteError) {
      console.error('❌ Erro ao deletar gastos pessoais:', deleteError);
      throw deleteError;
    }
    
    // Inserir todos novamente
    if (gastos && gastos.length > 0) {
      const gastosParaInserir = gastos.map(g => ({
        id: g.id,
        user_id: userId,
        descricao: g.descricao,
        valor: g.valor
      }));
      
      const { error: insertError } = await supabase
        .from('pricing_gastos_pessoais')
        .insert(gastosParaInserir);
      
      if (insertError) {
        console.error('❌ Erro ao inserir gastos pessoais:', insertError);
        throw insertError;
      }
      console.log('✅ Gastos pessoais salvos:', gastos.length);
    }
  }

  private async syncCustosEstudio(userId: string, custos: GastoItem[]): Promise<void> {
    console.log('🔄 Sincronizando custos de estúdio:', custos?.length || 0);
    
    // Estratégia: delete-all + insert-all (mais confiável que upsert)
    const { error: deleteError } = await supabase
      .from('pricing_custos_estudio')
      .delete()
      .eq('user_id', userId);
    
    if (deleteError) {
      console.error('❌ Erro ao deletar custos de estúdio:', deleteError);
      throw deleteError;
    }
    
    // Inserir todos novamente
    if (custos && custos.length > 0) {
      const custosParaInserir = custos.map(c => ({
        id: c.id,
        user_id: userId,
        descricao: c.descricao,
        valor: c.valor,
        origem: 'manual'
      }));
      
      const { error: insertError } = await supabase
        .from('pricing_custos_estudio')
        .insert(custosParaInserir);
      
      if (insertError) {
        console.error('❌ Erro ao inserir custos de estúdio:', insertError);
        throw insertError;
      }
      console.log('✅ Custos de estúdio salvos:', custos.length);
    }
  }

  private async syncEquipamentos(userId: string, equipamentos: Equipamento[]): Promise<void> {
    console.log('🔄 Sincronizando equipamentos:', equipamentos?.length || 0);
    
    // Estratégia: delete-all + insert-all (mais confiável que upsert com onConflict)
    const { error: deleteError } = await supabase
      .from('pricing_equipamentos')
      .delete()
      .eq('user_id', userId);
    
    if (deleteError) {
      console.error('❌ Erro ao deletar equipamentos:', deleteError);
      throw deleteError;
    }
    
    // Inserir todos novamente
    if (equipamentos && equipamentos.length > 0) {
      const equipamentosParaInserir = equipamentos.map(eq => ({
        id: eq.id,
        user_id: userId,
        nome: eq.nome,
        valor_pago: eq.valorPago,
        data_compra: eq.dataCompra || new Date().toISOString().split('T')[0],
        vida_util: eq.vidaUtil || 5
      }));
      
      console.log('📦 Inserindo equipamentos:', equipamentosParaInserir);
      
      const { error: insertError } = await supabase
        .from('pricing_equipamentos')
        .insert(equipamentosParaInserir);
      
      if (insertError) {
        console.error('❌ Erro ao inserir equipamentos:', insertError);
        throw insertError;
      }
      console.log('✅ Equipamentos salvos:', equipamentos.length);
    }
  }

  async loadEstruturaCustos(): Promise<EstruturaCustosFixos> {
    try {
      const userId = await this.ensureUser();
      
      // Buscar tudo em paralelo
      const [configRes, gastosRes, custosRes, equipamentosRes] = await Promise.all([
        supabase.from('pricing_configuracoes').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('pricing_gastos_pessoais').select('*').eq('user_id', userId),
        supabase.from('pricing_custos_estudio').select('*').eq('user_id', userId),
        supabase.from('pricing_equipamentos').select('*').eq('user_id', userId)
      ]);
      
      const config = configRes.data;
      const gastos = (gastosRes.data || []).map(g => ({
        id: g.id,
        descricao: g.descricao,
        valor: Number(g.valor),
        user_id: g.user_id,
        created_at: g.created_at,
        updated_at: g.updated_at
      })) as GastoItem[];
      
      const custos = (custosRes.data || []).map(c => ({
        id: c.id,
        descricao: c.descricao,
        valor: Number(c.valor),
        user_id: c.user_id,
        created_at: c.created_at,
        updated_at: c.updated_at
      })) as GastoItem[];
      
      const equipamentos = (equipamentosRes.data || []).map(eq => ({
        id: eq.id,
        nome: eq.nome,
        valorPago: Number(eq.valor_pago),
        dataCompra: eq.data_compra,
        vidaUtil: eq.vida_util,
        user_id: eq.user_id,
        created_at: eq.created_at,
        updated_at: eq.updated_at
      })) as Equipamento[];
      
      // Calcular total
      const totalGastos = gastos.reduce((sum, g) => sum + g.valor, 0);
      const percentualProLabore = config?.percentual_pro_labore || 30;
      const proLaboreCalculado = totalGastos * (1 + percentualProLabore / 100);
      const totalCustos = custos.reduce((sum, c) => sum + c.valor, 0);
      const totalDepreciacao = equipamentos.reduce((sum, eq) => sum + (eq.valorPago / (eq.vidaUtil * 12)), 0);
      const totalCalculado = proLaboreCalculado + totalCustos + totalDepreciacao;
      
      return {
        gastosPessoais: gastos,
        percentualProLabore,
        custosEstudio: custos,
        equipamentos,
        totalCalculado,
        user_id: userId,
        created_at: config?.created_at,
        updated_at: config?.updated_at
      };
      
    } catch (error) {
      console.error('❌ Erro ao carregar estrutura de custos:', error);
      return this.createDefaultEstruturaCustos();
    }
  }

  // ============= PADRÃO DE HORAS =============
  
  async savePadraoHoras(dados: PadraoHoras): Promise<boolean> {
    try {
      const userId = await this.ensureUser();
      
      const { error } = await supabase
        .from('pricing_configuracoes')
        .upsert({
          user_id: userId,
          horas_disponiveis: dados.horasDisponiveis,
          dias_trabalhados: dados.diasTrabalhados
        }, { onConflict: 'user_id' });
      
      if (error) throw error;
      
      console.log('✅ Padrão de horas salvo no Supabase');
      return true;
      
    } catch (error) {
      console.error('❌ Erro ao salvar padrão de horas:', error);
      return false;
    }
  }

  async loadPadraoHoras(): Promise<PadraoHoras> {
    try {
      const userId = await this.ensureUser();
      
      const { data } = await supabase
        .from('pricing_configuracoes')
        .select('horas_disponiveis, dias_trabalhados, created_at, updated_at')
        .eq('user_id', userId)
        .maybeSingle();
      
      return {
        horasDisponiveis: data?.horas_disponiveis || 8,
        diasTrabalhados: data?.dias_trabalhados || 5,
        user_id: userId,
        created_at: data?.created_at,
        updated_at: data?.updated_at
      };
      
    } catch (error) {
      console.error('❌ Erro ao carregar padrão de horas:', error);
      return this.createDefaultPadraoHoras();
    }
  }

  // ============= METAS =============
  
  async saveMetas(dados: MetasPrecificacao): Promise<boolean> {
    try {
      const userId = await this.ensureUser();
      
      const { error } = await supabase
        .from('pricing_configuracoes')
        .upsert({
          user_id: userId,
          margem_lucro_desejada: dados.margemLucroDesejada,
          ano_meta: dados.ano,
          meta_faturamento_anual: dados.metaFaturamentoAnual,
          meta_lucro_anual: dados.metaLucroAnual
        }, { onConflict: 'user_id' });
      
      if (error) throw error;
      
      console.log('✅ Metas salvas no Supabase');
      return true;
      
    } catch (error) {
      console.error('❌ Erro ao salvar metas:', error);
      return false;
    }
  }

  async loadMetas(): Promise<MetasPrecificacao> {
    try {
      const userId = await this.ensureUser();
      const currentYear = new Date().getFullYear();
      
      const { data } = await supabase
        .from('pricing_configuracoes')
        .select('margem_lucro_desejada, ano_meta, meta_faturamento_anual, meta_lucro_anual, created_at, updated_at')
        .eq('user_id', userId)
        .maybeSingle();
      
      return {
        margemLucroDesejada: data?.margem_lucro_desejada || 30,
        ano: data?.ano_meta || currentYear,
        metaFaturamentoAnual: data?.meta_faturamento_anual || 0,
        metaLucroAnual: data?.meta_lucro_anual || 0,
        user_id: userId,
        created_at: data?.created_at,
        updated_at: data?.updated_at
      };
      
    } catch (error) {
      console.error('❌ Erro ao carregar metas:', error);
      return this.createDefaultMetas();
    }
  }

  // ============= CALCULADORA =============
  
  async saveCalculadora(dados: EstadoCalculadora): Promise<boolean> {
    try {
      const userId = await this.ensureUser();
      
      // Primeiro, buscar ou criar registro default
      const { data: existente } = await supabase
        .from('pricing_calculadora_estados')
        .select('id')
        .eq('user_id', userId)
        .eq('is_default', true)
        .maybeSingle();
      
      const calculadoraId = existente?.id || dados.id || crypto.randomUUID();
      
      // Se existe, update. Se não, insert
      if (existente?.id) {
        const { error } = await supabase
          .from('pricing_calculadora_estados')
          .update({
            nome: dados.nome || 'Estado padrão',
            horas_estimadas: dados.horasEstimadas,
            markup: dados.markup,
            produtos: JSON.stringify(dados.produtos),
            custos_extras: JSON.stringify(dados.custosExtras),
            custo_total_calculado: dados.custoTotalCalculado,
            preco_final_calculado: dados.precoFinalCalculado,
            lucratividade: dados.lucratividade
          })
          .eq('id', existente.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('pricing_calculadora_estados')
          .insert({
            id: calculadoraId,
            user_id: userId,
            nome: dados.nome || 'Estado padrão',
            horas_estimadas: dados.horasEstimadas,
            markup: dados.markup,
            produtos: JSON.stringify(dados.produtos),
            custos_extras: JSON.stringify(dados.custosExtras),
            custo_total_calculado: dados.custoTotalCalculado,
            preco_final_calculado: dados.precoFinalCalculado,
            lucratividade: dados.lucratividade,
            is_default: true
          });
        
        if (error) throw error;
      }
      
      console.log('✅ Estado da calculadora salvo no Supabase');
      return true;
      
    } catch (error) {
      console.error('❌ Erro ao salvar calculadora:', error);
      return false;
    }
  }

  async loadCalculadora(): Promise<EstadoCalculadora | null> {
    try {
      const userId = await this.ensureUser();
      
      const { data } = await supabase
        .from('pricing_calculadora_estados')
        .select('*')
        .eq('user_id', userId)
        .eq('is_default', true)
        .maybeSingle();
      
      if (!data) return null;
      
      return {
        id: data.id,
        nome: data.nome || undefined,
        horasEstimadas: Number(data.horas_estimadas) || 0,
        markup: Number(data.markup) || 2,
        produtos: (data.produtos as any[]) || [],
        custosExtras: (data.custos_extras as any[]) || [],
        custoTotalCalculado: Number(data.custo_total_calculado) || 0,
        precoFinalCalculado: Number(data.preco_final_calculado) || 0,
        lucratividade: Number(data.lucratividade) || 0,
        salvo_automaticamente: true,
        user_id: data.user_id,
        created_at: data.created_at,
        updated_at: data.updated_at
      };
      
    } catch (error) {
      console.error('❌ Erro ao carregar calculadora:', error);
      return null;
    }
  }

  async clearCalculadora(): Promise<boolean> {
    try {
      const userId = await this.ensureUser();
      
      const { error } = await supabase
        .from('pricing_calculadora_estados')
        .delete()
        .eq('user_id', userId)
        .eq('is_default', true);
      
      if (error) throw error;
      
      console.log('✅ Calculadora limpa no Supabase');
      return true;
      
    } catch (error) {
      console.error('❌ Erro ao limpar calculadora:', error);
      return false;
    }
  }

  // ============= VALIDAÇÃO =============
  
  async validateSystem(): Promise<DadosValidacao> {
    const agora = new Date().toISOString();
    
    try {
      const estrutura = await this.loadEstruturaCustos();
      const horas = await this.loadPadraoHoras();
      const metas = await this.loadMetas();
      
      const errosEstrutura = this.validateEstruturaCustos(estrutura);
      const horasValido = horas.horasDisponiveis > 0 && horas.diasTrabalhados > 0;
      const metasValido = metas.margemLucroDesejada >= 0;
      
      return {
        estruturaCustos: errosEstrutura.length === 0,
        padraoHoras: horasValido,
        metas: metasValido,
        calculadora: true,
        ultimaValidacao: agora
      };
      
    } catch (error) {
      console.error('❌ Erro na validação:', error);
      return {
        estruturaCustos: false,
        padraoHoras: false,
        metas: false,
        calculadora: false,
        ultimaValidacao: agora
      };
    }
  }

  // ============= BACKUP =============
  
  async exportData(): Promise<string> {
    const estrutura = await this.loadEstruturaCustos();
    const horas = await this.loadPadraoHoras();
    const metas = await this.loadMetas();
    const calculadora = await this.loadCalculadora();
    
    const backup = {
      versao: '2.0.0',
      dataExport: new Date().toISOString(),
      user_id: this.userId,
      estruturaCustos: estrutura,
      padraoHoras: horas,
      metas,
      estadosCalculadora: calculadora ? [calculadora] : [],
      configuracaoSistema: {
        versaoApp: '2.0.0',
        storage: 'supabase'
      }
    };
    
    return JSON.stringify(backup, null, 2);
  }

  async importData(data: string): Promise<boolean> {
    try {
      const backup = JSON.parse(data);
      
      await this.saveEstruturaCustos(backup.estruturaCustos);
      await this.savePadraoHoras(backup.padraoHoras);
      await this.saveMetas(backup.metas);
      
      if (backup.estadosCalculadora?.length > 0) {
        await this.saveCalculadora(backup.estadosCalculadora[0]);
      }
      
      return true;
    } catch (error) {
      console.error('❌ Erro ao importar dados:', error);
      return false;
    }
  }

  // ============= HELPERS =============
  
  private createDefaultEstruturaCustos(): EstruturaCustosFixos {
    return {
      gastosPessoais: [],
      percentualProLabore: 30,
      custosEstudio: [],
      equipamentos: [],
      totalCalculado: 0,
      user_id: this.userId || undefined,
      created_at: new Date().toISOString()
    };
  }

  private createDefaultPadraoHoras(): PadraoHoras {
    return {
      horasDisponiveis: 8,
      diasTrabalhados: 5,
      user_id: this.userId || undefined,
      created_at: new Date().toISOString()
    };
  }

  private createDefaultMetas(): MetasPrecificacao {
    const currentYear = new Date().getFullYear();
    return {
      margemLucroDesejada: 30,
      ano: currentYear,
      metaFaturamentoAnual: 0,
      metaLucroAnual: 0,
      user_id: this.userId || undefined,
      created_at: new Date().toISOString()
    };
  }

  private validateEstruturaCustos(dados: EstruturaCustosFixos): string[] {
    const erros: string[] = [];
    
    if (dados.percentualProLabore < 0 || dados.percentualProLabore > 200) {
      erros.push('Percentual de pró-labore deve estar entre 0% e 200%');
    }
    
    dados.gastosPessoais.forEach((gasto, index) => {
      if (!gasto.descricao?.trim()) {
        erros.push(`Gasto pessoal ${index + 1}: Descrição é obrigatória`);
      }
      if (gasto.valor < 0) {
        erros.push(`Gasto pessoal ${index + 1}: Valor não pode ser negativo`);
      }
    });
    
    dados.equipamentos.forEach((eq, index) => {
      if (!eq.nome?.trim()) {
        erros.push(`Equipamento ${index + 1}: Nome é obrigatório`);
      }
      if (eq.valorPago < 0) {
        erros.push(`Equipamento ${index + 1}: Valor pago não pode ser negativo`);
      }
      if (eq.vidaUtil <= 0) {
        erros.push(`Equipamento ${index + 1}: Vida útil deve ser maior que zero`);
      }
    });
    
    return erros;
  }
}
