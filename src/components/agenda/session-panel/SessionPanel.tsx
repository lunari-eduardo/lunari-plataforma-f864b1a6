/**
 * SessionPanel — painel lateral único de gerenciamento da sessão da Agenda.
 *
 * Substitui `AppointmentForm` (nova sessão) e `AppointmentDetails` (edição).
 * Os três estados — nova, pendente e confirmada — usam exatamente o mesmo
 * layout, a mesma ordem de seções e os mesmos componentes. Apenas o
 * comportamento de alguns blocos muda.
 *
 * Ordem fixa: Cliente → Sessão → Financeiro → Cobrança → Informações → Status.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar,
  CalendarDays,
  Clock,
  CreditCard,
  DollarSign,
  ExternalLink,
  FileText,
  Package,
  Paperclip,
  Send,
  Tag,
  Trash2,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { formatDateForInput, safeParseInputDate, formatDateForStorage } from '@/utils/dateUtils';
import { toTitleCase } from '@/hooks/useTitleCase';

import { PanelSection, PanelField } from './PanelSection';
import ClientSearchCombobox from '../ClientSearchCombobox';
import PackageSearchCombobox from '../PackageSearchCombobox';
import { CategorySelector } from '@/components/ui/category-selector';
import { ClientEditModal } from '../ClientEditModal';
import { AppointmentDeleteConfirmModal } from '../AppointmentDeleteConfirmModal';
import { SlotConflictDialog } from '../SlotConflictDialog';
import { ChargeModal } from '@/components/cobranca/ChargeModal';
import { SendBriefingModal } from '@/components/formularios/SendBriefingModal';

import { useOrcamentos } from '@/hooks/useOrcamentos';
import { useClientesRealtime } from '@/hooks/useClientesRealtime';
import { useAgendaConflict } from '@/hooks/useAgendaConflict';
import { useAppointmentWorkflowInfo } from '@/hooks/useAppointmentWorkflowInfo';
import { useCobranca } from '@/hooks/useCobranca';
import { useNumberInput } from '@/hooks/useNumberInput';
import { supabase } from '@/integrations/supabase/client';
import { extractAgendaErrorMessage } from '@/utils/agendaSlotGuard';
import type { Appointment, AppointmentStatus } from '@/modules/agenda/presentation';

export interface SessionPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Modo edição quando presente; modo criação quando ausente. */
  appointment?: Appointment | null;
  initialDate?: Date;
  initialTime?: string;
  preselectedClienteId?: string;
  onSave: (data: any) => void | Promise<void>;
  /** Persistência silenciosa (não fecha o painel) antes de gerar cobrança. */
  onPersist?: (data: any) => void | Promise<void>;
  onDelete?: (id: string, action?: 'preserve' | 'refund' | 'remove') => void;
}

interface PanelFormState {
  date: Date;
  time: string;
  clienteId: string;
  clientName: string;
  status: AppointmentStatus;
  description: string;
  packageId: string;
  categoria: string;
  paidAmount: number;
}

const STATUS_META: Record<AppointmentStatus, { label: string; dot: string; chip: string }> = {
  'a confirmar': {
    label: 'Pendente',
    dot: 'bg-lunar-warning',
    chip: 'bg-lunar-warning/15 text-lunar-warning border-lunar-warning/30',
  },
  confirmado: {
    label: 'Confirmado',
    dot: 'bg-lunar-success',
    chip: 'bg-lunar-success/15 text-lunar-success border-lunar-success/30',
  },
};

export default function SessionPanel({
  open,
  onOpenChange,
  appointment = null,
  initialDate,
  initialTime,
  preselectedClienteId,
  onSave,
  onPersist,
  onDelete,
}: SessionPanelProps) {
  const isEdit = !!appointment;
  const { pacotes, categorias } = useOrcamentos();
  const { clientes, adicionarCliente } = useClientesRealtime();
  const { guard, dialogProps } = useAgendaConflict();
  const { workflowInfo } = useAppointmentWorkflowInfo(appointment?.id);

  const [showClientEdit, setShowClientEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showCharge, setShowCharge] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [newClientMode, setNewClientMode] = useState(false);
  const [newClient, setNewClient] = useState({ nome: '', telefone: '' });
  const [saving, setSaving] = useState(false);
  const [cobrarAoSalvar, setCobrarAoSalvar] = useState(false);
  const [chargeSessionId, setChargeSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const buildInitialState = useCallback((): PanelFormState => {
    if (appointment) {
      const fallbackId =
        appointment.clienteId ||
        clientes.find(c => c.nome?.trim().toLowerCase() === appointment.title?.trim().toLowerCase())?.id ||
        '';
      return {
        date: appointment.date,
        time: appointment.time,
        clienteId: fallbackId,
        clientName: appointment.title,
        status: appointment.status,
        description: appointment.description || '',
        packageId: appointment.packageId || '',
        categoria: '',
        paidAmount: appointment.paidAmount || 0,
      };
    }
    const cli = preselectedClienteId ? clientes.find(c => c.id === preselectedClienteId) : undefined;
    return {
      date: initialDate || new Date(),
      time: initialTime || '09:00',
      clienteId: preselectedClienteId || '',
      clientName: cli?.nome || '',
      status: 'a confirmar',
      description: '',
      packageId: '',
      categoria: '',
      paidAmount: 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointment, initialDate, initialTime, preselectedClienteId, clientes]);

  const [form, setForm] = useState<PanelFormState>(buildInitialState);
  const [dateInput, setDateInput] = useState(() => formatDateForInput(form.date));
  const [timeInput, setTimeInput] = useState(form.time);

  // Reidrata sempre que o painel abre (ou muda o agendamento alvo)
  useEffect(() => {
    if (!open) return;
    const next = buildInitialState();
    setForm(next);
    setDateInput(formatDateForInput(next.date));
    setTimeInput(next.time);
    setShowSchedule(false);
    setNewClientMode(false);
    setNewClient({ nome: '', telefone: '' });
    setCobrarAoSalvar(false);
    setChargeSessionId(null);
    setShowHistory(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, appointment?.id]);

  const selectedPackage = useMemo(
    () => pacotes.find((p: any) => p.id === form.packageId),
    [pacotes, form.packageId],
  );
  const valorPacote = Number(
    (selectedPackage as any)?.valor ??
      (selectedPackage as any)?.valor_base ??
      (selectedPackage as any)?.valorVenda ??
      0,
  );

  const packageCategoryName = useMemo(() => {
    if (!selectedPackage) return '';
    const pkg = selectedPackage as any;
    if (pkg.categorias?.nome) return pkg.categorias.nome;
    if (typeof pkg.categoria === 'string') return pkg.categoria;
    return '';
  }, [selectedPackage]);

  const cliente = useMemo(
    () => clientes.find(c => c.id === form.clienteId),
    [clientes, form.clienteId],
  );
  const clientDisplayName = cliente?.nome || form.clientName;

  const paidInput = useNumberInput({
    value: form.paidAmount,
    onChange: (value) => setForm(prev => ({ ...prev, paidAmount: parseFloat(value) || 0 })),
  });

  /* ---------------------------------- Cobrança --------------------------------- */
  const { cobrancas } = useCobranca({
    sessionId: appointment?.sessionId,
    clienteId: !appointment?.sessionId ? form.clienteId || undefined : undefined,
  });
  const cobranca = cobrancas[0];
  const cobrancaLink =
    cobranca?.mpPaymentLink || cobranca?.ipCheckoutUrl || cobranca?.mpPixCopiaCola || '';

  /* --------------------------------- Handlers ---------------------------------- */
  const handlePackageSelect = (packageId: string, packageData?: any) => {
    const pkg = packageData || pacotes.find((p: any) => p.id === packageId);
    setForm(prev => ({
      ...prev,
      packageId,
      clientName: prev.clientName,
      categoria: prev.categoria || (pkg?.categorias?.nome ?? prev.categoria),
    }));
  };

  const commitDate = () => {
    const parsed = safeParseInputDate(dateInput);
    if (parsed) setForm(prev => ({ ...prev, date: parsed }));
    else setDateInput(formatDateForInput(form.date));
  };

  const commitTime = () => {
    if (!timeInput) {
      setTimeInput(form.time);
      return;
    }
    setForm(prev => ({ ...prev, time: timeInput }));
  };

  const buildPayload = (state: PanelFormState, resolved: { clienteId: string; nome: string }) => {
    const pkg = pacotes.find((p: any) => p.id === state.packageId) as any;
    const categoryLabel = pkg?.categorias?.nome || pkg?.categoria || state.categoria || 'Sessão';
    const base = {
      date: isEdit ? formatDateForStorage(state.date) : state.date,
      time: state.time,
      title: resolved.nome,
      client: resolved.nome,
      clienteId: resolved.clienteId,
      type: categoryLabel,
      category: pkg?.nome,
      status: state.status,
      description: state.description,
      packageId: state.packageId,
      paidAmount: state.paidAmount,
    };
    if (isEdit) return { ...base, id: appointment!.id };
    return {
      ...base,
      valorPacote,
      whatsapp: cliente?.telefone || newClient.telefone || '',
      email: cliente?.email || '',
      clientPhone: cliente?.telefone || newClient.telefone || '',
      clientEmail: cliente?.email || '',
    };
  };

  const resolveClient = async (): Promise<{ clienteId: string; nome: string } | null> => {
    if (form.clienteId) {
      return { clienteId: form.clienteId, nome: clientDisplayName };
    }
    if (newClientMode && newClient.nome.trim()) {
      const criado = await adicionarCliente({
        nome: newClient.nome.trim(),
        telefone: newClient.telefone || '',
        email: '',
      });
      return { clienteId: criado.id, nome: newClient.nome.trim() };
    }
    if (isEdit) {
      return { clienteId: '', nome: form.clientName };
    }
    toast.error('Selecione um cliente do CRM.');
    return null;
  };

  /**
   * Localiza o session_id do agendamento recém-criado (fluxo "cobrar ao salvar").
   * Faz algumas tentativas curtas porque a criação é assíncrona.
   */
  const findCreatedSessionId = async (
    clienteId: string,
    date: Date,
    time: string,
  ): Promise<string | null> => {
    const dateStr = formatDateForStorage(date);
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const userId = auth?.user?.id;
        if (userId) {
          const { data } = await supabase
            .from('appointments')
            .select('session_id, created_at')
            .eq('user_id', userId)
            .eq('cliente_id', clienteId)
            .eq('date', dateStr)
            .eq('time', time)
            .order('created_at', { ascending: false })
            .limit(1);
          const sid = (data as any[])?.[0]?.session_id;
          if (sid) return sid as string;
        }
      } catch {
        /* tenta de novo */
      }
      await new Promise(r => setTimeout(r, 500));
    }
    return null;
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const parsedDate = safeParseInputDate(dateInput) ?? form.date;
      const finalTime = timeInput || form.time;
      const resolved = await resolveClient();
      if (!resolved) return;

      await guard({
        date: parsedDate,
        time: finalTime,
        status: form.status,
        ignoreAppointmentId: appointment?.id,
        silentOnPending: form.status !== 'confirmado',
        exec: async () => {
          const next = { ...form, date: parsedDate, time: finalTime };
          setForm(next);
          await onSave(buildPayload(next, resolved));

          // Fluxo "Cobrar ao salvar": abre o modal de cobrança logo após criar
          if (!isEdit && cobrarAoSalvar && resolved.clienteId) {
            const sid = await findCreatedSessionId(resolved.clienteId, parsedDate, finalTime);
            setChargeSessionId(sid);
            setShowCharge(true);
          }
        },
      });
    } catch (err) {
      toast.error(extractAgendaErrorMessage(err));
    } finally {
      setTimeout(() => setSaving(false), 400);
    }
  };


  const handleGerarCobranca = async () => {
    if (!form.clienteId) {
      toast.error('Vincule um cliente do CRM para gerar cobrança.');
      return;
    }
    if (valorPacote <= 0 && form.paidAmount <= 0) {
      toast.error('Selecione um pacote ou informe uma entrada antes de cobrar.');
      return;
    }

    // Garantir vínculo da sessão antes da cobrança (idempotente)
    if (appointment?.sessionId) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: existing } = await supabase
            .from('clientes_sessoes')
            .select('id')
            .eq('session_id', appointment.sessionId)
            .eq('user_id', user.id)
            .maybeSingle();

          if (!existing) {
            const { error: insertErr } = await supabase.from('clientes_sessoes').insert({
              user_id: user.id,
              cliente_id: form.clienteId,
              session_id: appointment.sessionId,
              appointment_id: appointment.id,
              data_sessao: formatDateForStorage(form.date),
              hora_sessao: form.time,
              categoria: packageCategoryName || 'sessao',
              pacote: (selectedPackage as any)?.nome || null,
              status: 'agendado',
              valor_total: valorPacote || form.paidAmount || 0,
              valor_base_pacote: valorPacote || 0,
              valor_pago: 0,
              tipo_registro: 'workflow',
            });
            if (insertErr) {
              toast.error('Erro ao preparar cobrança. Tente novamente.');
              return;
            }
          }
        }
      } catch {
        toast.error('Erro ao preparar cobrança.');
        return;
      }

      if (onPersist) {
        try {
          await onPersist(buildPayload(form, { clienteId: form.clienteId, nome: clientDisplayName }));
        } catch (err) {
          toast.error(extractAgendaErrorMessage(err));
          return;
        }
      }
    }

    setShowCharge(true);
  };

  const statusMeta = STATUS_META[form.status];
  const contextLine = [
    format(form.date, 'dd MMM', { locale: ptBR }),
    form.time,
    packageCategoryName || form.categoria,
    (selectedPackage as any)?.nome || (form.packageId ? undefined : 'Sem pacote'),
  ].filter(Boolean) as string[];

  const overlayOpen = showCharge || showBriefing || showClientEdit || showDelete;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className={cn(
            'w-full sm:max-w-[520px] p-0 gap-0 flex flex-col',
            'h-dvh max-h-dvh bg-background backdrop-blur-none',
            overlayOpen && 'opacity-40 blur-[2px] pointer-events-none',
          )}
        >
          {/* ============================ CABEÇALHO FIXO ============================ */}
          <header className="shrink-0 border-b border-border/60 px-4 pt-4 pb-3 pr-12">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                {isEdit ? 'Sessão' : 'Nova sessão'}
              </h2>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
                  statusMeta.chip,
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', statusMeta.dot)} />
                {statusMeta.label}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowSchedule(v => !v)}
              className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {contextLine.map((part, i) => (
                <span key={i} className="flex items-center gap-2">
                  {i > 0 && <span className="text-border">•</span>}
                  {part}
                </span>
              ))}
              <CalendarDays className="h-3.5 w-3.5 ml-1 opacity-70" />
            </button>

            {showSchedule && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <PanelField label="Data" htmlFor="sp-date">
                  <Input
                    id="sp-date"
                    type="date"
                    value={dateInput}
                    onChange={(e) => setDateInput(e.target.value)}
                    onBlur={commitDate}
                    className="h-10 rounded-lg text-sm"
                  />
                </PanelField>
                <PanelField label="Horário" htmlFor="sp-time">
                  <Input
                    id="sp-time"
                    type="time"
                    value={timeInput}
                    onChange={(e) => setTimeInput(e.target.value)}
                    onBlur={commitTime}
                    className="h-10 rounded-lg text-sm"
                  />
                </PanelField>
              </div>
            )}
          </header>

          {/* =========================== CONTEÚDO ROLÁVEL =========================== */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
            {/* -------------------------------- CLIENTE -------------------------------- */}
            <PanelSection
              icon={User}
              title="Cliente"
              action={
                form.clienteId ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg text-xs"
                    onClick={() => setShowClientEdit(true)}
                  >
                    Editar cliente
                  </Button>
                ) : undefined
              }
            >
              {form.clienteId ? (
                <div className="flex items-center gap-2.5">
                  <span className="text-base font-medium text-foreground truncate">
                    {clientDisplayName}
                  </span>
                  <span className="shrink-0 rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                    CRM
                  </span>
                </div>
              ) : newClientMode ? (
                <div className="space-y-2">
                  <Input
                    value={newClient.nome}
                    onChange={(e) => setNewClient(p => ({ ...p, nome: toTitleCase(e.target.value) }))}
                    placeholder="Nome do cliente"
                    className="h-10 rounded-lg text-sm"
                  />
                  <Input
                    value={newClient.telefone}
                    onChange={(e) => setNewClient(p => ({ ...p, telefone: e.target.value }))}
                    placeholder="Telefone"
                    className="h-10 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setNewClientMode(false)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Buscar no CRM
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <ClientSearchCombobox
                    value={form.clienteId}
                    onSelect={(id) => {
                      const c = clientes.find(x => x.id === id);
                      setForm(prev => ({ ...prev, clienteId: id, clientName: c?.nome || prev.clientName }));
                    }}
                    placeholder="Buscar cliente no CRM..."
                  />
                  <button
                    type="button"
                    onClick={() => setNewClientMode(true)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Novo cliente
                  </button>
                </div>
              )}
            </PanelSection>

            {/* -------------------------------- SESSÃO --------------------------------- */}
            <PanelSection icon={Calendar} title="Sessão">
              <PanelField label="Categoria">
                <CategorySelector
                  categorias={categorias as unknown as string[]}
                  value={form.categoria}
                  onValueChange={(categoria) =>
                    setForm(prev => ({ ...prev, categoria, packageId: '' }))
                  }
                  placeholder="Filtrar pacotes..."
                />
              </PanelField>

              <PanelField label="Pacote">
                <PackageSearchCombobox
                  value={form.packageId}
                  onSelect={handlePackageSelect}
                  placeholder="Selecionar pacote..."
                  filtrarPorCategoria={form.categoria}
                  hidePrice
                />
              </PanelField>
            </PanelSection>

            {/* ------------------------------ FINANCEIRO ------------------------------- */}
            <PanelSection icon={DollarSign} title="Financeiro">
              <PanelField label="Entrada" htmlFor="sp-entrada">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    R$
                  </span>
                  <Input
                    id="sp-entrada"
                    type="number"
                    min="0"
                    step="0.01"
                    value={paidInput.displayValue}
                    onChange={paidInput.handleChange}
                    onFocus={paidInput.handleFocus}
                    placeholder="0,00"
                    className="h-10 rounded-lg pl-10 text-sm"
                  />
                </div>
              </PanelField>
            </PanelSection>

            {/* ------------------------------- COBRANÇA -------------------------------- */}
            <PanelSection
              icon={CreditCard}
              title="Cobrança"
              action={
                isEdit && (!cobranca || cobranca.status === 'pago') ? (
                  <Button size="sm" className="h-8 rounded-lg text-xs" onClick={handleGerarCobranca}>
                    <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                    {cobranca?.status === 'pago' ? 'Nova cobrança' : 'Gerar cobrança'}
                  </Button>
                ) : undefined
              }
            >
              {!isEdit ? (
                <div className="space-y-2">
                  <label
                    htmlFor="sp-cobrar-ao-salvar"
                    className="flex items-start justify-between gap-3 cursor-pointer"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm text-foreground">Cobrar ao salvar</span>
                      <span className="block text-[11px] text-muted-foreground">
                        Abre o link de cobrança logo após criar. A sessão é confirmada
                        automaticamente quando o pagamento for aprovado.
                      </span>
                    </span>
                    <Switch
                      id="sp-cobrar-ao-salvar"
                      checked={cobrarAoSalvar}
                      onCheckedChange={setCobrarAoSalvar}
                    />
                  </label>
                  {cobrarAoSalvar && (
                    <p className="text-[11px] text-muted-foreground">
                      Valor sugerido:{' '}
                      <span className="text-foreground">
                        R$ {(valorPacote > 0 ? valorPacote : form.paidAmount || 0).toFixed(2)}
                      </span>
                    </p>
                  )}
                </div>
              ) : !cobranca ? (
                <p className="text-xs text-muted-foreground">Nenhuma cobrança criada.</p>
              ) : cobranca.status === 'pago' ? (
                <p className="text-sm text-lunar-success">✓ Pago</p>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    <span className="text-foreground">Aguardando pagamento</span>
                    {' • '}
                    {cobranca.provedor === 'pix_manual' ? 'PIX' : cobranca.tipoCobranca.toUpperCase()}
                    {' • '}
                    R$ {cobranca.valor.toFixed(2)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {cobrancaLink && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg text-xs"
                        onClick={() => window.open(cobrancaLink, '_blank', 'noopener')}
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                        Ver cobrança
                      </Button>
                    )}
                    {cobrancaLink && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-lg text-xs"
                        onClick={() => {
                          navigator.clipboard?.writeText(cobrancaLink);
                          toast('Link copiado');
                        }}
                      >
                        <Send className="h-3.5 w-3.5 mr-1.5" />
                        Reenviar
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </PanelSection>

            {/* ------------------------------ INFORMAÇÕES ------------------------------ */}
            <PanelSection icon={FileText} title="Informações">
              <PanelField label="Observações" htmlFor="sp-obs">
                <Textarea
                  id="sp-obs"
                  value={form.description}
                  onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Notas sobre a sessão..."
                  className="min-h-[72px] rounded-lg text-sm resize-none"
                />
              </PanelField>
              {isEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg text-xs"
                  onClick={() => {
                    if (!form.clienteId) {
                      toast.error('Vincule um cliente do CRM para enviar o briefing.');
                      return;
                    }
                    setShowBriefing(true);
                  }}
                >
                  <Paperclip className="h-3.5 w-3.5 mr-1.5" />
                  Briefing
                </Button>
              )}
            </PanelSection>

            {/* -------------------------------- STATUS --------------------------------- */}
            {form.status !== 'confirmado' || !isEdit ? (
              <PanelSection icon={Tag} title="Status da sessão">
                <div className="grid grid-cols-2 gap-2">
                  {(['a confirmar', 'confirmado'] as AppointmentStatus[]).map((value) => {
                    const meta = STATUS_META[value];
                    const active = form.status === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, status: value }))}
                        className={cn(
                          'flex h-10 items-center justify-center gap-2 rounded-lg border text-sm transition-colors',
                          active
                            ? meta.chip
                            : 'border-border/60 text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', active ? meta.dot : 'bg-muted-foreground/40')} />
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </PanelSection>
            ) : null}
          </div>

          {/* ============================= RODAPÉ FIXO ============================== */}
          <footer className="shrink-0 border-t border-border/60 px-4 py-3 flex items-center justify-between gap-2">
            {isEdit && onDelete ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 rounded-lg text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Excluir sessão
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-lg text-xs"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button size="sm" className="h-9 rounded-lg text-xs" onClick={handleSave} disabled={saving}>
                {isEdit ? 'Salvar alterações' : 'Criar sessão'}
              </Button>
            </div>
          </footer>
        </SheetContent>
      </Sheet>

      {/* ------------------------------- Modais ---------------------------------- */}
      {form.clienteId && (
        <ClientEditModal
          open={showClientEdit}
          onOpenChange={setShowClientEdit}
          clienteId={form.clienteId}
          clienteNome={clientDisplayName}
          onSuccess={(novoNome) => {
            if (novoNome) setForm(prev => ({ ...prev, clientName: novoNome }));
          }}
        />
      )}

      {isEdit && onDelete && (
        <AppointmentDeleteConfirmModal
          isOpen={showDelete}
          onClose={() => setShowDelete(false)}
          onConfirm={(action) => onDelete(appointment!.id, action)}
          appointmentData={{
            id: appointment!.id,
            sessionId: appointment!.sessionId,
            title: appointment!.title,
            clientName: appointment!.client,
            date: format(appointment!.date, 'dd/MM/yyyy', { locale: ptBR }),
            hasWorkflowSession: workflowInfo.hasSession,
            hasPayments: workflowInfo.hasPayments,
          }}
        />
      )}

      {showCharge && form.clienteId && (
        <ChargeModal
          isOpen={showCharge}
          onClose={() => setShowCharge(false)}
          clienteId={form.clienteId}
          clienteNome={clientDisplayName}
          clienteWhatsapp={cliente?.telefone}
          sessionId={appointment?.sessionId}
          valorSugerido={valorPacote > 0 ? valorPacote : form.paidAmount || 0}
        />
      )}

      {showBriefing && form.clienteId && (
        <SendBriefingModal
          open={showBriefing}
          onOpenChange={setShowBriefing}
          clienteId={form.clienteId}
          clienteNome={clientDisplayName}
          clienteTelefone={cliente?.telefone}
          sessionId={appointment?.sessionId}
        />
      )}

      <SlotConflictDialog {...dialogProps} />
    </>
  );
}
