
import { useAppContext } from '@/contexts/AppContext';
import { formatDateForStorage, getCurrentDateString } from '@/utils/dateUtils';

export type AppointmentStatus = 'confirmado' | 'a confirmar';

export interface Appointment {
  id: string;
  title: string;
  date: Date;
  time: string;
  type: string;
  client: string;
  status: AppointmentStatus;
  description?: string;
  packageId?: string;
  paidAmount?: number;
  email?: string;
  whatsapp?: string;
  orcamentoId?: string;
  origem?: 'agenda' | 'orcamento';
}

export const useAgenda = () => {
  const context = useAppContext();

  // Função para converter agendamentos confirmados em sessões do workflow filtrados por mês
  const getConfirmedSessionsForWorkflow = (month?: number, year?: number, getClienteByName?: (nome: string) => any, pacotesData?: any[], produtosData?: any[]) => {
    let filteredAppointments = context.appointments.filter(appointment => appointment.status === 'confirmado');
    
    // Se mês e ano foram especificados, filtrar por eles
    if (month !== undefined && year !== undefined) {
      filteredAppointments = filteredAppointments.filter(appointment => {
        const date = appointment.date instanceof Date ? appointment.date : new Date(appointment.date);
        const appointmentMonth = date.getMonth() + 1; // getMonth() retorna 0-11
        const appointmentYear = date.getFullYear();
        return appointmentMonth === month && appointmentYear === year;
      });
    }
    
    return filteredAppointments.map(appointment => {
      // Buscar dados do cliente no CRM se a função for fornecida
      const clienteData = getClienteByName ? getClienteByName(appointment.client) : null;
      
      // Buscar pacote real baseado no packageId usando dados das configurações
      let pacote = "";
      let valorPacote = "R$ 0,00";
      let categoria = "";
      let valorFotoExtra = "R$ 35,00";
      
      if (appointment.packageId && pacotesData) {
        const pacoteEncontrado = pacotesData.find(p => p.id === appointment.packageId);
        if (pacoteEncontrado) {
          pacote = pacoteEncontrado.nome;
          valorPacote = `R$ ${pacoteEncontrado.valor.toFixed(2).replace('.', ',')}`;
          categoria = pacoteEncontrado.categoria || "";
          valorFotoExtra = `R$ ${pacoteEncontrado.valorFotoExtra || 35}.00`.replace('.', ',');
        }
      }
      
      // Se não encontrou pacote nas configurações, tentar mapear pela categoria do tipo
      if (!pacote) {
        categoria = appointment.type.includes('Gestante') ? 'Gestante' : 
                   appointment.type.includes('Família') ? 'Família' : 
                   appointment.type.includes('Corporativo') ? 'Corporativo' : 'Outros';
      }

      return {
        id: appointment.id,
        data: formatDateForStorage(appointment.date), // Usar string de data padronizada
        hora: appointment.time,
        nome: appointment.client,
        email: clienteData?.email || appointment.email || "",
        descricao: appointment.description || appointment.type,
        status: "", // Status vazio por padrão para workflow
        whatsapp: clienteData?.telefone || appointment.whatsapp || "",
        categoria: categoria,
        pacote: pacote,
        valorPacote: valorPacote,
        valorFotoExtra: valorFotoExtra,
        qtdFotosExtra: 0,
        valorTotalFotoExtra: "R$ 0,00",
        produto: "",
        qtdProduto: 0,
        valorTotalProduto: "R$ 0,00",
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
          data: getCurrentDateString() // Usar string de data
        }] : []
      };
    });
  };

  return {
    appointments: context.appointments,
    addAppointment: context.addAppointment,
    updateAppointment: context.updateAppointment,
    deleteAppointment: context.deleteAppointment,
    getConfirmedSessionsForWorkflow,
  };
};
