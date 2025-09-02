import { WorkflowItem } from '@/contexts/AppContext';
import { Appointment } from '@/hooks/useAgenda';
import { formatDateForStorage, getCurrentDateString } from '@/utils/dateUtils';

export interface AgendaWorkflowIntegrationConfig {
  clientes: any[];
  pacotes: any[];
  produtos: any[];
  configurationService: any;
  workflowItems: WorkflowItem[];
  congelarRegrasPrecoFotoExtra: (config: any) => any;
  criarProjeto: (config: any) => void;
}

/**
 * Service para gerenciar a integração crítica entre Agenda e Workflow
 * Preserva EXATAMENTE a lógica original do AppContext.tsx linhas 965-1134
 */
export class AgendaWorkflowIntegrationService {
  private config: AgendaWorkflowIntegrationConfig;

  constructor(config: AgendaWorkflowIntegrationConfig) {
    this.config = config;
  }

  private getProcessedAppointments(): Set<string> {
    try {
      const saved = localStorage.getItem('lunari_processed_appointments');
      return new Set(saved ? JSON.parse(saved) : []);
    } catch {
      return new Set();
    }
  }

  private saveProcessedAppointments(processed: Set<string>): void {
    try {
      localStorage.setItem('lunari_processed_appointments', JSON.stringify([...processed]));
    } catch (error) {
      console.error('❌ Erro ao salvar processamentos:', error);
    }
  }

  private shouldSync(id: string, currentTime: number): boolean {
    // Implementa o mesmo sistema de throttling que estava no useIntegration
    const lastSyncKey = `lastSync_${id}`;
    const lastSync = parseInt(localStorage.getItem(lastSyncKey) || '0');
    const timeDiff = currentTime - lastSync;
    
    if (timeDiff < 100) {
      return false;
    }
    
    localStorage.setItem(lastSyncKey, currentTime.toString());
    return true;
  }

  /**
   * Converte agendamentos confirmados em itens do workflow
   * PRESERVA EXATAMENTE a lógica do AppContext.tsx
   */
  convertConfirmedAppointmentsToWorkflow(appointments: Appointment[]): WorkflowItem[] {
    const confirmedAppointments = appointments.filter(app => app.status === 'confirmado');
    const newItems: WorkflowItem[] = [];
    const processedIds = new Set<string>();
    const alreadyProcessed = this.getProcessedAppointments();
    
    confirmedAppointments.forEach(appointment => {
      const appointmentKey = `agenda-${appointment.id}`;
      const currentTime = Date.now();
      
      // Evitar processamento duplicado
      if (alreadyProcessed.has(appointmentKey) || !this.shouldSync(appointmentKey, currentTime)) {
        return;
      }
      
      const existingItem = this.config.workflowItems.find(item => 
        item.id === appointmentKey && item.fonte === 'agenda'
      );
      
      if (!existingItem) {
        // Buscar dados do pacote selecionado
        let pacoteData = null;
        let categoriaName = '';
        let valorFotoExtraFromPackage = 35;
        
        if (appointment.packageId) {
          pacoteData = this.config.pacotes.find(p => p.id === appointment.packageId);
          if (pacoteData) {
            if (pacoteData.categoria_id) {
              const configCategorias = this.config.configurationService.loadCategorias();
              const categoria = configCategorias.find((cat: any) => cat.id === pacoteData.categoria_id);
              categoriaName = categoria ? categoria.nome : String(pacoteData.categoria_id);
            } else {
              categoriaName = pacoteData.categoria || '';
            }
            valorFotoExtraFromPackage = pacoteData.valor_foto_extra || pacoteData.valorFotoExtra || 35;
          }
        }
        
        if (!pacoteData) {
          categoriaName = appointment.type.includes('Gestante') ? 'Gestante' : 
                        appointment.type.includes('Família') ? 'Família' : 
                        appointment.type.includes('Corporativo') ? 'Corporativo' : 'Outros';
        }

        // CONGELAR REGRAS APENAS UMA VEZ
        const regrasCongeladas = this.config.congelarRegrasPrecoFotoExtra({
          valorFotoExtra: valorFotoExtraFromPackage,
          categoria: categoriaName,
          categoriaId: pacoteData?.categoria_id
        });

        const clienteId = this.config.clientes.find(c => 
          c.nome.toLowerCase().trim() === appointment.client.toLowerCase().trim()
        )?.id;

        const newWorkflowItem: WorkflowItem = {
          id: appointmentKey,
          sessionId: `session-agenda-${appointment.id}`,
          data: formatDateForStorage(appointment.date),
          hora: appointment.time,
          nome: appointment.client,
          whatsapp: (appointment as any).clientPhone || appointment.whatsapp || "+55 (11) 99999-9999",
          email: (appointment as any).clientEmail || appointment.email || "",
          descricao: appointment.description || '',
          status: "",
          categoria: categoriaName,
          clienteId: clienteId,
          pacote: pacoteData ? pacoteData.nome : (
            appointment.type.includes('Gestante') ? 'Completo' : 
            appointment.type.includes('Família') ? 'Básico' : 
            appointment.type.includes('Corporativo') ? 'Empresarial' : 'Básico'
          ),
          valorPacote: pacoteData ? (pacoteData.valor_base || pacoteData.valorVenda || pacoteData.valor || 0) : (
            appointment.type.includes('Gestante') ? 980 :
            appointment.type.includes('Família') ? 650 :
            appointment.type.includes('Corporativo') ? 890 : 650
          ),
          desconto: 0,
          valorFotoExtra: valorFotoExtraFromPackage,
          qtdFotoExtra: 0,
          valorTotalFotoExtra: 0,
          produto: "",
          qtdProduto: 0,
          valorTotalProduto: 0,
          valorAdicional: 0,
          detalhes: appointment.description || "",
          total: 0,
          valorPago: appointment.paidAmount || 0,
          restante: 0,
          pagamentos: appointment.paidAmount ? [{
            id: 'initial',
            valor: appointment.paidAmount,
            data: getCurrentDateString()
          }] : [],
          fonte: 'agenda',
          dataOriginal: appointment.date,
          regrasDePrecoFotoExtraCongeladas: regrasCongeladas
        };

        // Adicionar produtos incluídos
        let allProductsFromAppointment: any[] = [];
        
        if (appointment.produtosIncluidos && appointment.produtosIncluidos.length > 0) {
          allProductsFromAppointment = appointment.produtosIncluidos.map(p => ({
            nome: p.nome,
            quantidade: p.quantidade,
            valorUnitario: 0,
            tipo: 'incluso' as const
          }));
        }
        else if (pacoteData && pacoteData.produtosIncluidos && pacoteData.produtosIncluidos.length > 0) {
          allProductsFromAppointment = pacoteData.produtosIncluidos.map((produtoIncluido: any) => {
            const produtoData = this.config.produtos.find(p => p.id === produtoIncluido.produtoId);
            return {
              nome: produtoData?.nome || 'Produto não encontrado',
              quantidade: produtoIncluido.quantidade || 1,
              valorUnitario: 0,
              tipo: 'incluso' as const
            };
          });
        }

        newWorkflowItem.produtosList = allProductsFromAppointment;

        if (allProductsFromAppointment.length > 0) {
          const primeiroProduto = allProductsFromAppointment[0];
          newWorkflowItem.produto = `${primeiroProduto.nome} (incluso no pacote)`;
          newWorkflowItem.qtdProduto = primeiroProduto.quantidade;
          newWorkflowItem.valorTotalProduto = primeiroProduto.valorUnitario * primeiroProduto.quantidade;
        }

        newWorkflowItem.total = newWorkflowItem.valorPacote + newWorkflowItem.valorTotalFotoExtra + 
                               newWorkflowItem.valorTotalProduto + newWorkflowItem.valorAdicional - newWorkflowItem.desconto;
        newWorkflowItem.restante = newWorkflowItem.total - newWorkflowItem.valorPago;

        newItems.push(newWorkflowItem);
        processedIds.add(appointmentKey);
      }
    });

    // Marcar como processados e criar projetos
    if (newItems.length > 0) {
      const currentProcessed = this.getProcessedAppointments();
      processedIds.forEach(id => currentProcessed.add(id));
      this.saveProcessedAppointments(currentProcessed);
      
      // Criar projetos com timeout para quebrar loops
      setTimeout(() => {
        newItems.forEach(item => {
          this.config.criarProjeto({
            clienteId: item.clienteId || '',
            nome: item.nome,
            categoria: item.categoria,
            pacote: item.pacote,
            descricao: item.descricao,
            detalhes: item.detalhes,
            whatsapp: item.whatsapp,
            email: item.email,
            dataAgendada: item.dataOriginal || new Date(item.data),
            horaAgendada: item.hora,
            valorPacote: item.valorPacote,
            fonte: 'agenda',
            agendamentoId: item.id
          });
        });
      }, 0);
    }

    return newItems;
  }

  /**
   * Função para converter agendamentos em sessões do workflow (preserva getConfirmedSessionsForWorkflow)
   */
  getConfirmedSessionsForWorkflow(
    appointments: Appointment[],
    month?: number, 
    year?: number, 
    getClienteByName?: (nome: string) => any, 
    pacotesData?: any[], 
    produtosData?: any[]
  ) {
    // Criar Maps para lookups O(1)
    const pacoteMap = new Map();
    const produtoMap = new Map();
    
    if (pacotesData) {
      pacotesData.forEach(p => {
        pacoteMap.set(p.id, p);
        if (p.nome) pacoteMap.set(p.nome, p);
      });
    }
    
    if (produtosData) {
      produtosData.forEach(p => {
        produtoMap.set(p.id, p);
      });
    }
    
    // Filtrar e mapear em uma única passagem
    return appointments
      .filter(appointment => {
        if (appointment.status !== 'confirmado') return false;
        
        if (month !== undefined && year !== undefined) {
          const date = appointment.date instanceof Date ? appointment.date : new Date(appointment.date);
          const appointmentMonth = date.getMonth() + 1;
          const appointmentYear = date.getFullYear();
          return appointmentMonth === month && appointmentYear === year;
        }
        
        return true;
      })
      .map(appointment => {
        const clienteData = getClienteByName?.(appointment.client);
        
        // Busca otimizada de pacote usando Map
        let pacoteData = null;
        if (appointment.packageId && pacoteMap.size > 0) {
          pacoteData = pacoteMap.get(appointment.packageId) || 
                      pacoteMap.get(appointment.packageId.replace(/^(orcamento-|pacote-|agenda-)/, '')) ||
                      (appointment.type && pacoteMap.get(appointment.type));
        }
        
        const pacote = pacoteData?.nome || "";
        const valorPacote = pacoteData ? `R$ ${(pacoteData.valor || pacoteData.valor_base || pacoteData.valorVenda || 0).toFixed(2).replace('.', ',')}` : "R$ 0,00";
        const categoria = pacoteData?.categoria || 
          (appointment.type.includes('Gestante') ? 'Gestante' : 
           appointment.type.includes('Família') ? 'Família' : 
           appointment.type.includes('Corporativo') ? 'Corporativo' : 'Outros');
        const valorFotoExtra = pacoteData ? `R$ ${(pacoteData.valorFotoExtra || pacoteData.valor_foto_extra || 35).toFixed(2).replace('.', ',')}` : "R$ 35,00";
        
        // Produtos incluídos otimizados
        const produtosList = appointment.produtosIncluidos?.map(p => ({
          nome: p.nome,
          quantidade: p.quantidade,
          valorUnitario: p.valorUnitario,
          tipo: 'incluso' as const
        })) || 
        (pacoteData?.produtosIncluidos?.map((pi: any) => {
          const produto = produtoMap.get(pi.produtoId);
          return {
            nome: produto?.nome || 'Produto não encontrado',
            quantidade: pi.quantidade || 1,
            valorUnitario: produto?.valorVenda || produto?.preco_venda || 0,
            tipo: 'incluso' as const
          };
        }) || []);
        
        const primeiroProduto = produtosList[0];
        
        return {
          id: appointment.id,
          data: formatDateForStorage(appointment.date),
          hora: appointment.time,
          nome: appointment.client,
          email: clienteData?.email || appointment.email || "",
          descricao: appointment.description || "",
          status: "",
          whatsapp: clienteData?.telefone || appointment.whatsapp || "",
          clienteId: appointment.clienteId || clienteData?.id || '',
          categoria,
          pacote,
          valorPacote,
          valorFotoExtra,
          qtdFotosExtra: 0,
          valorTotalFotoExtra: "R$ 0,00",
          produto: primeiroProduto ? `${primeiroProduto.nome} (incluso no pacote)` : "",
          qtdProduto: primeiroProduto?.quantidade || 0,
          valorTotalProduto: primeiroProduto ? `R$ ${(primeiroProduto.valorUnitario * primeiroProduto.quantidade).toFixed(2).replace('.', ',')}` : "R$ 0,00",
          valorAdicional: "R$ 0,00",
          detalhes: appointment.description || "",
          desconto: 0,
          valor: valorPacote,
          total: valorPacote,
          valorPago: `R$ ${(appointment.paidAmount || 0).toFixed(2).replace('.', ',')}`,
          restante: `R$ ${(parseFloat(valorPacote.replace(/[^\d,]/g, '').replace(',', '.')) - (appointment.paidAmount || 0)).toFixed(2).replace('.', ',')}`,
          pagamentos: appointment.paidAmount ? [{
            id: 'p1',
            valor: appointment.paidAmount,
            data: getCurrentDateString()
          }] : [],
          produtosList
        };
      });
  }
}