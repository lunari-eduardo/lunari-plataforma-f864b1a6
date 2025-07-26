import { addDummyAppointmentsToStorage, removeDummyAppointmentsFromStorage } from './createDummyAppointments';

// Função para criar dados fantasmas
export const createDummyData = () => {
  const result = addDummyAppointmentsToStorage();
  
  if (result.success) {
    // Recarregar a página para que os dados sejam carregados
    setTimeout(() => window.location.reload(), 500);
  }
  
  return result;
};

// Função para remover dados fantasmas
export const removeDummyData = () => {
  const result = removeDummyAppointmentsFromStorage();
  
  if (result.success) {
    // Recarregar a página para que os dados sejam removidos
    setTimeout(() => window.location.reload(), 500);
  }
  
  return result;
};