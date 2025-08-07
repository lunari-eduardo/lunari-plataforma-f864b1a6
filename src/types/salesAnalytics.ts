/**
 * Tipos normalizados para análise de vendas
 * Estrutura limpa e migrável para Supabase
 */

export interface NormalizedWorkflowData {
  id: string;
  sessionId: string;
  data: string; // YYYY-MM-DD format
  hora: string;
  nome: string;
  whatsapp: string;
  email: string;
  descricao: string;
  status: string;
  categoria: string;
  pacote: string;
  valorPacote: number;
  desconto: number;
  valorFotoExtra: number;
  qtdFotosExtra: number;
  valorTotalFotoExtra: number;
  valorAdicional: number;
  detalhes: string;
  total: number;
  valorPago: number;
  restante: number;
  fonte: 'agenda' | 'orcamento';
  clienteId?: string;
  month: number; // 0-11 (Jan-Dec)
  year: number;
  date: Date; // Parsed date object
}

export interface SalesMetrics {
  totalRevenue: number;
  totalSessions: number;
  averageTicket: number;
  newClients: number;
  monthlyGoalProgress: number;
  conversionRate: number;
}

export interface MonthlyData {
  month: string;
  monthIndex: number; // 0-11 for sorting
  revenue: number;
  sessions: number;
  averageTicket: number;
  extraPhotoRevenue: number;
  goal: number;
}

export interface CategoryData {
  name: string;
  sessions: number;
  revenue: number;
  percentage: number;
  totalExtraPhotos: number;
  packageDistribution: PackageDistribution[];
}

export interface PackageDistribution {
  packageName: string;
  count: number;
  percentage: number;
}

export interface PackageDistributionData {
  name: string;
  sessions: number;
  percentage: number;
}