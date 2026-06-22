import { Appointment } from '@/modules/agenda/presentation';

// Dados fictícios para criar agendamentos variados
const clientesNomes = [
  'Ana Silva', 'Carlos Santos', 'Maria Oliveira', 'João Pereira', 'Fernanda Costa',
  'Rafael Lima', 'Juliana Rodrigues', 'Lucas Almeida', 'Camila Ferreira', 'Diego Martins',
  'Patrícia Souza', 'Bruno Barbosa', 'Letícia Ribeiro', 'Thiago Carvalho', 'Amanda Torres'
];

const pacotes = [
  'Ensaio Família', 'Casamento Completo', 'Book Feminino', 'Ensaio Casal', 'Formatura',
  'Aniversário 15 Anos', 'Gestante', 'Newborn', 'Corporativo', 'Fashion'
];

const categorias = [
  'Ensaio Externo', 'Evento', 'Estúdio', 'Casamento', 'Corporativo'
];

const horarios = [
  '08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00'
];

// Função para gerar email baseado no nome
const gerarEmail = (nome: string): string => {
  const nomeFormatado = nome.toLowerCase()
    .replace('ã', 'a').replace('ç', 'c').replace(/\s+/g, '.');
  return `${nomeFormatado}@email.com`;
};

// Função para gerar WhatsApp fictício
const gerarWhatsApp = (): string => {
  return `(11) 9${Math.floor(Math.random() * 9000 + 1000)}-${Math.floor(Math.random() * 9000 + 1000)}`;
};

// Função para gerar data aleatória em um mês específico
const gerarDataAleatoria = (mes: number, ano: number = 2024): Date => {
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const diaAleatorio = Math.floor(Math.random() * diasNoMes) + 1;
  return new Date(ano, mes - 1, diaAleatorio);
};

// Função principal para criar agendamentos fictícios
export const createFakeAppointmentsForMonths = (): Omit<Appointment, 'id'>[] => {
  const appointments: Omit<Appointment, 'id'>[] = [];
  const meses = [6, 7, 8]; // Junho, Julho, Agosto
  
  meses.forEach(mes => {
    // Criar 8-12 agendamentos por mês
    const quantidadeAgendamentos = Math.floor(Math.random() * 5) + 8;
    
    for (let i = 0; i < quantidadeAgendamentos; i++) {
      const clienteAleatorio = clientesNomes[Math.floor(Math.random() * clientesNomes.length)];
      const pacoteAleatorio = pacotes[Math.floor(Math.random() * pacotes.length)];
      const categoriaAleatoria = categorias[Math.floor(Math.random() * categorias.length)];
      const horarioAleatorio = horarios[Math.floor(Math.random() * horarios.length)];
      const dataAleatoria = gerarDataAleatoria(mes);
      
      const appointment: Omit<Appointment, 'id'> = {
        title: `${pacoteAleatorio} - ${clienteAleatorio}`,
        date: dataAleatoria,
        time: horarioAleatorio,
        type: categoriaAleatoria,
        client: clienteAleatorio,
        status: 'confirmado',
        description: `Sessão de ${pacoteAleatorio.toLowerCase()} agendada para ${clienteAleatorio}`,
        email: gerarEmail(clienteAleatorio),
        whatsapp: gerarWhatsApp(),
        origem: 'agenda' as const
      };
      
      appointments.push(appointment);
    }
  });
  
  return appointments;
};

// Função para aplicar os agendamentos fictícios
export const applyFakeAppointments = (addAppointmentFn: (appointment: Omit<Appointment, 'id'>) => Appointment) => {
  const fakeAppointments = createFakeAppointmentsForMonths();
  
  console.log(`🎭 Criando ${fakeAppointments.length} agendamentos fictícios...`);
  
  const createdAppointments = fakeAppointments.map(appointment => {
    return addAppointmentFn(appointment);
  });
  
  console.log(`✅ ${createdAppointments.length} agendamentos criados com sucesso!`);
  
  return createdAppointments;
};