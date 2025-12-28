import type { Lead, LeadStatusDef } from '@/types/leads';
import type { LeadInteraction, FollowUpConfig } from '@/types/leadInteractions';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

// Type aliases for Supabase tables
type SupabaseLead = Tables<'leads'>;
type SupabaseLeadStatus = Tables<'lead_statuses'>;
type SupabaseFollowUpConfig = Tables<'lead_follow_up_config'>;

/**
 * Transform Supabase lead row to frontend Lead type
 */
export function supabaseLeadToFrontend(row: SupabaseLead): Lead {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email || '',
    telefone: row.telefone || '',
    whatsapp: row.whatsapp || undefined,
    origem: row.origem || undefined,
    status: row.status || 'novo_interessado',
    observacoes: row.observacoes || undefined,
    dataCriacao: row.created_at,
    arquivado: row.arquivado || false,
    dataAtualizacao: row.updated_at,
    clienteId: row.cliente_id || undefined,
    interacoes: (row.interacoes as unknown as LeadInteraction[]) || [],
    ultimaInteracao: row.ultima_interacao || undefined,
    diasSemInteracao: row.dias_sem_interacao || 0,
    needsFollowUp: row.needs_follow_up || false,
    statusTimestamp: row.status_timestamp || undefined,
    needsScheduling: row.needs_scheduling || false,
    scheduledAppointmentId: row.scheduled_appointment_id || undefined,
    motivoPerda: row.motivo_perda || undefined,
    perdidoEm: row.perdido_em || undefined,
    historicoStatus: (row.historico_status as Lead['historicoStatus']) || [],
  };
}

/**
 * Transform frontend Lead to Supabase insert format
 */
export function frontendLeadToSupabase(
  lead: Omit<Lead, 'id' | 'dataCriacao'>,
  userId: string
): TablesInsert<'leads'> {
  return {
    user_id: userId,
    nome: lead.nome,
    email: lead.email || null,
    telefone: lead.telefone || null,
    whatsapp: lead.whatsapp || null,
    origem: lead.origem || 'manual',
    status: lead.status || 'novo_interessado',
    observacoes: lead.observacoes || null,
    arquivado: lead.arquivado || false,
    cliente_id: lead.clienteId || null,
    interacoes: (lead.interacoes || []) as unknown as Tables<'leads'>['interacoes'],
    ultima_interacao: lead.ultimaInteracao || null,
    needs_follow_up: lead.needsFollowUp || false,
    status_timestamp: lead.statusTimestamp || new Date().toISOString(),
    needs_scheduling: lead.needsScheduling || false,
    scheduled_appointment_id: lead.scheduledAppointmentId || null,
    motivo_perda: lead.motivoPerda || null,
    perdido_em: lead.perdidoEm || null,
    historico_status: (lead.historicoStatus || []) as unknown as Tables<'leads'>['historico_status'],
  };
}

/**
 * Transform partial frontend Lead updates to Supabase format
 */
export function frontendLeadUpdatesToSupabase(
  updates: Partial<Lead>
): Partial<Tables<'leads'>> {
  const result: Record<string, unknown> = {};

  if (updates.nome !== undefined) result.nome = updates.nome;
  if (updates.email !== undefined) result.email = updates.email || null;
  if (updates.telefone !== undefined) result.telefone = updates.telefone || null;
  if (updates.whatsapp !== undefined) result.whatsapp = updates.whatsapp || null;
  if (updates.origem !== undefined) result.origem = updates.origem || null;
  if (updates.status !== undefined) result.status = updates.status;
  if (updates.observacoes !== undefined) result.observacoes = updates.observacoes || null;
  if (updates.arquivado !== undefined) result.arquivado = updates.arquivado;
  if (updates.clienteId !== undefined) result.cliente_id = updates.clienteId || null;
  if (updates.interacoes !== undefined) result.interacoes = updates.interacoes;
  if (updates.ultimaInteracao !== undefined) result.ultima_interacao = updates.ultimaInteracao || null;
  if (updates.diasSemInteracao !== undefined) result.dias_sem_interacao = updates.diasSemInteracao;
  if (updates.needsFollowUp !== undefined) result.needs_follow_up = updates.needsFollowUp;
  if (updates.statusTimestamp !== undefined) result.status_timestamp = updates.statusTimestamp;
  if (updates.needsScheduling !== undefined) result.needs_scheduling = updates.needsScheduling;
  if (updates.scheduledAppointmentId !== undefined) result.scheduled_appointment_id = updates.scheduledAppointmentId || null;
  if (updates.motivoPerda !== undefined) result.motivo_perda = updates.motivoPerda || null;
  if (updates.perdidoEm !== undefined) result.perdido_em = updates.perdidoEm || null;
  if (updates.historicoStatus !== undefined) result.historico_status = updates.historicoStatus;

  return result as Partial<Tables<'leads'>>;
}

/**
 * Transform Supabase lead_statuses row to frontend LeadStatusDef
 */
export function supabaseStatusToFrontend(row: SupabaseLeadStatus): LeadStatusDef {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    order: row.sort_order,
    color: row.color || undefined,
    isConverted: row.is_converted || false,
    isLost: row.is_lost || false,
  };
}

/**
 * Transform frontend LeadStatusDef to Supabase insert format
 */
export function frontendStatusToSupabase(
  status: LeadStatusDef,
  userId: string
): TablesInsert<'lead_statuses'> {
  return {
    user_id: userId,
    key: status.key,
    name: status.name,
    sort_order: status.order,
    color: status.color || '#6b7280',
    is_converted: status.isConverted || false,
    is_lost: status.isLost || false,
  };
}

/**
 * Transform Supabase follow_up_config row to frontend FollowUpConfig
 */
export function supabaseConfigToFrontend(row: SupabaseFollowUpConfig): FollowUpConfig {
  return {
    diasParaFollowUp: row.dias_para_follow_up || 3,
    ativo: row.ativo ?? true,
    statusMonitorado: row.status_monitorado || 'orcamento_enviado',
  };
}

/**
 * Transform frontend FollowUpConfig to Supabase insert format
 */
export function frontendConfigToSupabase(
  config: FollowUpConfig,
  userId: string
): TablesInsert<'lead_follow_up_config'> {
  return {
    user_id: userId,
    dias_para_follow_up: config.diasParaFollowUp,
    ativo: config.ativo,
    status_monitorado: config.statusMonitorado,
  };
}

/**
 * Default lead statuses for new users
 */
export const DEFAULT_LEAD_STATUSES: LeadStatusDef[] = [
  { id: 'novo_interessado', key: 'novo_interessado', name: 'Novo - Interessado', order: 1, color: '#3b82f6' },
  { id: 'aguardando', key: 'aguardando', name: 'Aguardando', order: 2, color: '#f59e0b' },
  { id: 'orcamento_enviado', key: 'orcamento_enviado', name: 'Orçamento Enviado', order: 3, color: '#8b5cf6' },
  { id: 'followup', key: 'followup', name: 'Follow-up', order: 4, color: '#f97316' },
  { id: 'fechado', key: 'fechado', name: 'Fechado', order: 5, isConverted: true, color: '#10b981' },
  { id: 'perdido', key: 'perdido', name: 'Perdido', order: 6, isLost: true, color: '#ef4444' },
];

/**
 * Default follow-up config
 */
export const DEFAULT_FOLLOW_UP_CONFIG: FollowUpConfig = {
  diasParaFollowUp: 3,
  ativo: true,
  statusMonitorado: 'orcamento_enviado',
};
