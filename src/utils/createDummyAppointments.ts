import { Appointment } from '@/hooks/useAgenda';

export const createDummyAppointments = (): Appointment[] => {
  // Definir especificamente julho de 2025
  const targetMonth = 6; // Julho (0-indexado)
  const targetYear = 2025;

  const nomes = [
    'Ana Silva', 'Bruno Costa', 'Carla Santos', 'Diego Oliveira', 'Elena Ferreira',
    'Felipe Rodrigues', 'Gabriela Lima', 'Henrique Alves', 'Isabela Martins', 'João Pereira',
    'Karina Souza', 'Lucas Barbosa', 'Mariana Gomes', 'Nicolas Dias', 'Olivia Castro'
  ];

  const tipos = [
    'Ensaio Gestante Premium', 'Ensaio Família Completo', 'Book Corporativo',
    'Ensaio Casal Romântico', 'Ensaio Infantil', 'Ensaio Gestante Básico',
    'Book Profissional', 'Ensaio Família Básico', 'Ensaio Newborn',
    'Casamento Civil', 'Formatura', 'Aniversário 15 Anos',
    'Book Moda', 'Ensaio Pets', 'Evento Corporativo'
  ];

  const pacoteIds = [
    'pac-gestante-premium', 'pac-familia-completo', 'pac-corporativo',
    'pac-casal-romantico', 'pac-infantil', 'pac-gestante-basico',
    'pac-profissional', 'pac-familia-basico', 'pac-newborn',
    'pac-casamento', 'pac-formatura', 'pac-aniversario',
    'pac-moda', 'pac-pets', 'pac-evento'
  ];

  const emails = [
    'ana.silva@email.com', 'bruno.costa@email.com', 'carla.santos@email.com',
    'diego.oliveira@email.com', 'elena.ferreira@email.com', 'felipe.rodrigues@email.com',
    'gabriela.lima@email.com', 'henrique.alves@email.com', 'isabela.martins@email.com',
    'joao.pereira@email.com', 'karina.souza@email.com', 'lucas.barbosa@email.com',
    'mariana.gomes@email.com', 'nicolas.dias@email.com', 'olivia.castro@email.com'
  ];

  const whatsapps = [
    '11987654321', '11876543210', '11765432109', '11654321098', '11543210987',
    '11432109876', '11321098765', '11210987654', '11109876543', '11098765432',
    '11987654320', '11876543219', '11765432108', '11654321097', '11543210986'
  ];

  const descriptions = [
    'Ensaio ao ar livre no parque', 'Sessão em estúdio com iluminação especial',
    'Fotos corporativas para LinkedIn', 'Ensaio romântico no pôr do sol',
    'Fotos divertidas com as crianças', 'Ensaio gestante em casa',
    'Book profissional para portfólio', 'Família reunida no jardim',
    'Primeira sessão do bebê', 'Cerimônia íntima de casamento',
    'Formatura em medicina', 'Festa de 15 anos temática',
    'Editorial de moda verão', 'Ensaio com pets no quintal',
    'Evento de lançamento de produto'
  ];

  return nomes.map((nome, index) => {
    // Distribuir as datas ao longo de julho de 2025
    const day = Math.floor((index / 15) * 30) + 1; // Distribuir entre dias 1-30
    const hour = 9 + (index % 8); // Horários entre 9h e 16h
    const minute = (index % 2) * 30; // 00 ou 30 minutos
    
    const appointmentDate = new Date(targetYear, targetMonth, day);
    const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

    // Valores aleatórios para os pagamentos
    const packageValues = [500, 800, 1200, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000];
    const packageValue = packageValues[index % packageValues.length];
    const paidAmount = Math.floor(packageValue * (0.3 + Math.random() * 0.7)); // 30% a 100% pago

    return {
      id: `dummy-${Date.now()}-${index}`,
      title: tipos[index],
      date: appointmentDate,
      time: timeString,
      type: tipos[index],
      client: nome,
      status: 'confirmado' as const,
      description: descriptions[index],
      packageId: pacoteIds[index],
      paidAmount: paidAmount,
      email: emails[index],
      whatsapp: whatsapps[index],
      origem: 'agenda' as const,
      produtosIncluidos: [
        {
          id: `prod-${index}-1`,
          nome: index % 3 === 0 ? 'Álbum Premium' : index % 3 === 1 ? 'Impressões 15x21' : 'Pen Drive Personalizado',
          quantidade: 1,
          valorUnitario: index % 3 === 0 ? 200 : index % 3 === 1 ? 150 : 100,
          tipo: 'incluso' as const
        }
      ]
    };
  });
};

export const addDummyAppointmentsToStorage = () => {
  try {
    // Buscar agendamentos existentes
    const existingAppointments = JSON.parse(localStorage.getItem('agenda_appointments') || '[]');
    
    // Criar novos agendamentos
    const dummyAppointments = createDummyAppointments();
    
    // Filtrar para não duplicar (verificar se já existem dummies)
    const hasDummies = existingAppointments.some((apt: any) => apt.id?.startsWith('dummy-'));
    
    if (!hasDummies) {
      // Adicionar os novos agendamentos
      const allAppointments = [...existingAppointments, ...dummyAppointments];
      
      // Salvar no localStorage
      localStorage.setItem('agenda_appointments', JSON.stringify(allAppointments));
      
      console.log('✅ 15 agendamentos fantasmas criados para julho de 2025!');
      return { success: true, message: '15 agendamentos criados para julho de 2025!' };
    } else {
      console.log('⚠️ Agendamentos fantasmas já existem no storage');
      return { success: false, message: 'Agendamentos fantasmas já existem' };
    }
  } catch (error) {
    console.error('❌ Erro ao criar agendamentos fantasmas:', error);
    return { success: false, message: 'Erro ao criar agendamentos' };
  }
};

export const removeDummyAppointmentsFromStorage = () => {
  try {
    // Buscar agendamentos existentes
    const existingAppointments = JSON.parse(localStorage.getItem('agenda_appointments') || '[]');
    
    // Filtrar removendo agendamentos fantasmas
    const realAppointments = existingAppointments.filter((apt: any) => !apt.id?.startsWith('dummy-'));
    
    // Salvar no localStorage
    localStorage.setItem('agenda_appointments', JSON.stringify(realAppointments));
    
    console.log('✅ Agendamentos fantasmas removidos!');
    return { success: true, message: 'Agendamentos fantasmas removidos!' };
  } catch (error) {
    console.error('❌ Erro ao remover agendamentos fantasmas:', error);
    return { success: false, message: 'Erro ao remover agendamentos' };
  }
};