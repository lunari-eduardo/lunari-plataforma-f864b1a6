// Hook especializado para gerenciamento de agendamentos
// Compatível com a API atual mas usando nova arquitetura

import { useMemo } from 'react';
import { useAgendaContext } from '@/contexts/AgendaContext';
import { Appointment } from './useAgenda';
import { formatDateForStorage, getCurrentDateString } from '@/utils/dateUtils';

export const useAppointments = () => {
  const {
    appointments,
    addAppointment,
    updateAppointment,
    deleteAppointment,
    getAppointmentsForDate
  } = useAgendaContext();

  // Função otimizada para converter agendamentos confirmados em sessões do workflow
  // Mantém compatibilidade com useAgenda atual
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
    };
  }, [appointments]);

  // Filtros e buscas otimizadas
  const getAppointmentsByStatus = useMemo(() => {
    return (status: 'confirmado' | 'a confirmar') => {
      return appointments.filter(apt => apt.status === status);
    };
  }, [appointments]);

  const getAppointmentsByDateRange = useMemo(() => {
    return (startDate: Date, endDate: Date) => {
      return appointments.filter(apt => {
        const aptDate = apt.date instanceof Date ? apt.date : new Date(apt.date);
        return aptDate >= startDate && aptDate <= endDate;
      });
    };
  }, [appointments]);

  const searchAppointments = useMemo(() => {
    return (query: string) => {
      const lowercaseQuery = query.toLowerCase();
      return appointments.filter(apt => 
        apt.client.toLowerCase().includes(lowercaseQuery) ||
        apt.title.toLowerCase().includes(lowercaseQuery) ||
        apt.description?.toLowerCase().includes(lowercaseQuery) ||
        apt.type.toLowerCase().includes(lowercaseQuery)
      );
    };
  }, [appointments]);

  return {
    appointments,
    addAppointment,
    updateAppointment,
    deleteAppointment,
    getConfirmedSessionsForWorkflow,
    getAppointmentsForDate,
    getAppointmentsByStatus,
    getAppointmentsByDateRange,
    searchAppointments
  };
};