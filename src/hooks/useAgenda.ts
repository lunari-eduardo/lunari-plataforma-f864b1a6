
import { useMemo } from 'react';
import { useAppointments } from './useAppointments';
import { formatDateForStorage, getCurrentDateString } from '@/utils/dateUtils';
import { configurationService } from '@/services/ConfigurationService';
import { useConfiguration } from './useConfiguration';

export type AppointmentStatus = 'confirmado' | 'a confirmar';

export interface ProdutoIncluido {
  id: string;
  nome: string;
  quantidade: number;
  valorUnitario: number;
  tipo: 'incluso' | 'manual';
}

export interface Appointment {
  id: string;
  sessionId?: string; // ID único universal para rastrear através de orçamento → agendamento → workflow
  title: string;
  date: Date;
  time: string;
  type: string;
  client: string;
  status: AppointmentStatus;
  description?: string;
  packageId?: string;
  produtosIncluidos?: ProdutoIncluido[];
  paidAmount?: number;
  email?: string;
  whatsapp?: string;
  orcamentoId?: string;
  origem?: 'agenda' | 'orcamento';
  clienteId?: string; // NOVO: Campo para relacionar com cliente específico (CRM)
}

export const useAgenda = () => {
  const { categorias } = useConfiguration();
  const appointmentsHook = useAppointments();

  // Otimizada função para converter agendamentos confirmados em sessões do workflow
  const getConfirmedSessionsForWorkflow = useMemo(() => {
    return (month?: number, year?: number, getClienteByName?: (nome: string) => any, pacotesData?: any[], produtosData?: any[]) => {
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
      return appointmentsHook.appointments
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
          
          // CORRIGIR CATEGORIA: Buscar por categoria_id no configurationService
          let categoria = '';
          if (pacoteData) {
            if (pacoteData.categoria_id) {
              const categoriaEncontrada = categorias.find((cat: any) => cat.id === pacoteData.categoria_id);
              categoria = categoriaEncontrada ? categoriaEncontrada.nome : String(pacoteData.categoria_id);
            } else {
              categoria = pacoteData.categoria || '';
            }
          }
          
          if (!categoria) {
            categoria = appointment.type.includes('Gestante') ? 'Gestante' : 
                       appointment.type.includes('Família') ? 'Família' : 
                       appointment.type.includes('Corporativo') ? 'Corporativo' : 'Outros';
          }
          
          const valorFotoExtra = pacoteData ? `R$ ${(pacoteData.valorFotoExtra || pacoteData.valor_foto_extra || 35).toFixed(2).replace('.', ',')}` : "R$ 35,00";
          
          // Produtos incluídos otimizados
          const produtosList = appointment.produtosIncluidos?.map(p => ({
            nome: p.nome,
            quantidade: p.quantidade,
            valorUnitario: p.valorUnitario,
            tipo: 'incluso' as const
          })) || 
          (pacoteData?.produtosIncluidos?.map(pi => {
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
    };
  }, []);

  return {
    appointments: appointmentsHook.appointments,
    addAppointment: appointmentsHook.addAppointment,
    updateAppointment: appointmentsHook.updateAppointment,
    deleteAppointment: appointmentsHook.deleteAppointment,
    getConfirmedSessionsForWorkflow,
  };
};
