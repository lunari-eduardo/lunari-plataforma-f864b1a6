import { Projeto, CriarProjetoInput, AtualizarProjetoInput } from '@/types/projeto';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';

/**
 * SERVIÇO CENTRAL DE PROJETOS
 * Substitui toda a lógica de workflow_sessions, WorkflowItem e sincronização
 * Esta é a única fonte de verdade para todos os projetos
 */
export class ProjetoService {
  private static readonly STORAGE_KEY = 'projetos';

  /**
   * Gera um ID único para projeto
   */
  private static gerarProjectId(): string {
    return `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Carrega todos os projetos
   */
  static carregarProjetos(): Projeto[] {
    try {
      const projetos = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
      return projetos.map((p: any) => ({
        ...p,
        dataAgendada: new Date(p.dataAgendada),
        criadoEm: new Date(p.criadoEm),
        atualizadoEm: new Date(p.atualizadoEm),
        dataOriginal: p.dataOriginal ? new Date(p.dataOriginal) : undefined
      }));
    } catch (error) {
      console.error('❌ Erro ao carregar projetos:', error);
      return [];
    }
  }

  /**
   * Salva todos os projetos
   */
  static salvarProjetos(projetos: Projeto[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(projetos));
    } catch (error) {
      console.error('❌ Erro ao salvar projetos:', error);
    }
  }

  /**
   * Busca um projeto por ID
   */
  static buscarPorId(projectId: string): Projeto | null {
    const projetos = this.carregarProjetos();
    return projetos.find(p => p.projectId === projectId) || null;
  }

  /**
   * Busca projetos por cliente
   */
  static buscarPorCliente(clienteId: string): Projeto[] {
    const projetos = this.carregarProjetos();
    return projetos.filter(p => p.clienteId === clienteId);
  }

  /**
   * FUNÇÃO PRINCIPAL: Criar ou atualizar projeto
   * Implementa a lógica à prova de duplicação
   */
  static criarProjeto(input: CriarProjetoInput): Projeto {
    const projetos = this.carregarProjetos();
    
    // VERIFICAR SE JÁ EXISTE (à prova de duplicação)
    const projetoExistente = projetos.find(p => 
      (input.orcamentoId && p.orcamentoId === input.orcamentoId) ||
      (input.agendamentoId && p.agendamentoId === input.agendamentoId) ||
      (p.clienteId === input.clienteId && 
       p.nome === input.nome && 
       p.dataAgendada.toDateString() === input.dataAgendada.toDateString())
    );

    if (projetoExistente) {
      console.log('🔄 Atualizando projeto existente:', projetoExistente.projectId);
      return this.atualizarProjeto(projetoExistente.projectId, {
        ...input,
        atualizadoEm: new Date()
      });
    }

    // CRIAR NOVO PROJETO
    const novoProjeto: Projeto = {
      projectId: this.gerarProjectId(),
      clienteId: input.clienteId,
      orcamentoId: input.orcamentoId,
      agendamentoId: input.agendamentoId,
      nome: input.nome,
      categoria: input.categoria,
      pacote: input.pacote,
      descricao: input.descricao || '',
      detalhes: input.detalhes || '',
      whatsapp: input.whatsapp || '',
      email: input.email || '',
      dataAgendada: input.dataAgendada,
      horaAgendada: input.horaAgendada,
      status: 'agendado',
      valorPacote: input.valorPacote || 0,
      valorFotosExtra: 0,
      qtdFotosExtra: 0,
      valorTotalFotosExtra: 0,
      valorProdutos: 0,
      valorAdicional: 0,
      desconto: 0,
      total: input.valorPacote || 0,
      valorPago: 0,
      restante: input.valorPacote || 0,
      pagamentos: [],
      produtosList: [],
      produto: '',
      qtdProduto: 0,
      valorTotalProduto: 0,
      valorFotoExtra: 0,
      fonte: input.fonte,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
      dataOriginal: input.dataAgendada
    };

    projetos.push(novoProjeto);
    this.salvarProjetos(projetos);

    console.log('✅ Novo projeto criado:', novoProjeto.projectId);
    return novoProjeto;
  }

  /**
   * Atualizar projeto existente
   */
  static atualizarProjeto(projectId: string, updates: AtualizarProjetoInput): Projeto {
    const projetos = this.carregarProjetos();
    const index = projetos.findIndex(p => p.projectId === projectId);

    if (index === -1) {
      throw new Error(`Projeto não encontrado: ${projectId}`);
    }

    const projetoAtualizado: Projeto = {
      ...projetos[index],
      ...updates,
      atualizadoEm: new Date()
    };

    // Recalcular totais se necessário
    if (updates.valorPacote !== undefined || 
        updates.valorTotalFotosExtra !== undefined || 
        updates.valorTotalProduto !== undefined || 
        updates.valorAdicional !== undefined || 
        updates.desconto !== undefined) {
      
      projetoAtualizado.total = projetoAtualizado.valorPacote + 
                               projetoAtualizado.valorTotalFotosExtra + 
                               projetoAtualizado.valorTotalProduto + 
                               projetoAtualizado.valorAdicional - 
                               projetoAtualizado.desconto;
      
      projetoAtualizado.restante = projetoAtualizado.total - projetoAtualizado.valorPago;
    }

    projetos[index] = projetoAtualizado;
    this.salvarProjetos(projetos);

    console.log('✅ Projeto atualizado:', projectId);
    return projetoAtualizado;
  }

  /**
   * Excluir projeto
   */
  static excluirProjeto(projectId: string): void {
    const projetos = this.carregarProjetos();
    const projetosFiltrados = projetos.filter(p => p.projectId !== projectId);
    this.salvarProjetos(projetosFiltrados);
    console.log('🗑️ Projeto excluído:', projectId);
  }

  /**
   * MIGRAÇÃO: Converter dados existentes para projetos
   */
  static migrarDadosExistentes(): void {
    console.log('🔄 Iniciando migração de dados para Projetos...');

    try {
      // Migrar workflow_sessions
      const workflowSessions = JSON.parse(localStorage.getItem('workflow_sessions') || '[]');
      const projetosExistentes = this.carregarProjetos();
      const novosProjectIds = new Set(projetosExistentes.map(p => p.projectId));

      workflowSessions.forEach((session: any) => {
        // Evitar duplicatas na migração
        const jaExiste = projetosExistentes.some(p => 
          p.clienteId === session.clienteId && 
          p.nome === session.nome && 
          new Date(p.dataAgendada).toDateString() === new Date(session.data).toDateString()
        );

        if (!jaExiste) {
          const projeto = this.criarProjeto({
            clienteId: session.clienteId || '',
            nome: session.nome || '',
            categoria: session.categoria || '',
            pacote: session.pacote || '',
            descricao: session.descricao || '',
            detalhes: session.detalhes || '',
            whatsapp: session.whatsapp || '',
            email: session.email || '',
            dataAgendada: new Date(session.data),
            horaAgendada: session.hora || '',
            valorPacote: this.parseValor(session.valorPacote || session.valor),
            fonte: session.fonte || 'agenda'
          });

          console.log('📦 Migrado para projeto:', projeto.projectId);
        }
      });

      console.log('✅ Migração concluída');
    } catch (error) {
      console.error('❌ Erro na migração:', error);
    }
  }

  /**
   * Parse valores monetários
   */
  private static parseValor(valor: string | number): number {
    if (typeof valor === 'number') return valor;
    if (!valor) return 0;
    
    const cleanValue = valor.toString()
      .replace(/R\$\s*/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .trim();
    
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Deduplicar projetos baseado em critérios únicos
   */
  static deduplicarProjetos(): void {
    console.log('🧹 Iniciando deduplicação de projetos...');
    
    const projetos = this.carregarProjetos();
    const projetosUnicos: Projeto[] = [];
    const chaves = new Set<string>();

    projetos
      .sort((a, b) => b.atualizadoEm.getTime() - a.atualizadoEm.getTime()) // Mais recentes primeiro
      .forEach(projeto => {
        const chave = `${projeto.clienteId}-${projeto.nome}-${projeto.dataAgendada.toDateString()}`;
        
        if (!chaves.has(chave)) {
          chaves.add(chave);
          projetosUnicos.push(projeto);
        } else {
          console.log('🗑️ Removendo duplicata:', projeto.projectId);
        }
      });

    this.salvarProjetos(projetosUnicos);
    console.log(`✅ Deduplicação concluída: ${projetos.length} → ${projetosUnicos.length}`);
  }
}