export type SortKey = 'nome' | 'totalFaturado' | 'totalPago' | 'aReceber' | 'sessoes';

export interface SortConfig {
  key: SortKey;
  direction: 'asc' | 'desc';
}

export type ViewMode = 'cards' | 'list';

export interface ClienteFormData {
  nome: string;
  email: string;
  telefone: string;
  origem: string;
}
