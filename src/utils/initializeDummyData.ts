import { addDummyAppointmentsToStorage } from './createDummyAppointments';

// Função para inicializar dados fantasmas
export const initializeDummyData = () => {
  // Adicionar agendamentos fantasmas
  const appointmentsAdded = addDummyAppointmentsToStorage();
  
  if (appointmentsAdded) {
    // Recarregar a página para que os dados sejam carregados
    window.location.reload();
  }
  
  return appointmentsAdded;
};