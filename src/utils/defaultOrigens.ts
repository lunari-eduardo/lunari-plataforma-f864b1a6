export interface OrigemPadrao {
  id: string;
  nome: string;
  cor: string;
}

export const ORIGENS_PADRAO: OrigemPadrao[] = [
  { id: 'instagram', nome: 'Instagram', cor: '#E1306C' },
  { id: 'google', nome: 'Google', cor: '#4285F4' },
  { id: 'facebook', nome: 'Facebook', cor: '#1877F2' },
  { id: 'indicacao-cliente', nome: 'Indicação de Cliente', cor: '#10B981' },
  { id: 'indicacao-parceiro', nome: 'Indicação de Parceiro', cor: '#8B5CF6' },
  { id: 'website', nome: 'Website', cor: '#F59E0B' },
  { id: 'cliente-antigo', nome: 'Cliente Antigo', cor: '#06B6D4' },
  { id: 'evento-feira', nome: 'Evento/Feira', cor: '#84CC16' },
  { id: 'outro', nome: 'Outro', cor: '#6B7280' },
];