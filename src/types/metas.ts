export interface MetaPersonalizada {
  id?: string;
  user_id?: string;
  ano: number;
  mes: number;
  meta_faturamento: number;
  meta_lucro: number;
  categoria?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MetaResolvidaParaPeriodo {
  metaFaturamento: number;
  metaLucro: number;
  origem: 'personalizada' | 'precificacao';
}
