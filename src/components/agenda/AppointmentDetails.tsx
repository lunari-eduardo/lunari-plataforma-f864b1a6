import { useState, useCallback, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatDateForInput, safeParseInputDate, formatDateForStorage } from '@/utils/dateUtils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from 'sonner';
import { useNumberInput } from '@/hooks/useNumberInput';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { useAppointmentWorkflowInfo } from '@/hooks/useAppointmentWorkflowInfo';
import { useFormulariosBySession } from '@/hooks/useFormulariosByCliente';
import { AppointmentDeleteConfirmModal } from './AppointmentDeleteConfirmModal';
import { ClientEditModal } from './ClientEditModal';
import { SendBriefingModal } from '@/components/formularios/SendBriefingModal';
import { FormularioRespostasView } from '@/components/formularios/FormularioRespostasView';
import { ChargeModal } from '@/components/cobranca/ChargeModal';
import { ClientCreditBadge } from '@/components/finance/ClientCreditBadge';
import { ClientCreditApplyModal } from '@/components/finance/ClientCreditApplyModal';
import { useClientesRealtime } from '@/hooks/useClientesRealtime';
import { supabase } from '@/integrations/supabase/client';
import { Appointment } from '@/modules/agenda/presentation';
import PackageSearchCombobox from './PackageSearchCombobox';
import { Calendar, DollarSign, FileText, History, ChevronRight, Loader2, Package, AlertCircle, UserRoundPen, ClipboardList, Eye, Send, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSlotAvailabilityCheck, type SlotCheckResult } from '@/hooks/useSlotAvailabilityCheck';
import { SlotConflictDialog } from './SlotConflictDialog';
import { allowBlockedWrite, parseAgendaTriggerError, extractAgendaErrorMessage } from '@/utils/agendaSlotGuard';
import { useAgendaConflict } from '@/hooks/useAgendaConflict';

interface AppointmentDetailsProps {
  appointment: Appointment;
  onSave: (appointmentData: any) => void;
  /** Persistência silenciosa que NÃO fecha o modal (ex.: antes de abrir cobrança). */
  onPersist?: (appointmentData: any) => void | Promise<void>;
  onCancel: () => void;
  onDelete: (id: string, action?: 'preserve' | 'refund' | 'remove') => void;
}

export default function AppointmentDetails({
  appointment,
  onSave,
  onPersist,
  onCancel,
  onDelete
}: AppointmentDetailsProps) {
  const { pacotes } = useOrcamentos();
  const { clientes } = useClientesRealtime();
  const { workflowInfo, sessionDetails, loadingDetails, fetchSessionDetails } = useAppointmentWorkflowInfo(appointment.id);
  const { data: sessionFormularios = [] } = useFormulariosBySession(appointment.sessionId);

  // Resolver clienteId via fallback por nome para agendamentos legados (cliente_id NULL no DB)
  const resolvedClienteId = appointment.clienteId
    || clientes.find(c => c.nome?.trim().toLowerCase() === appointment.title?.trim().toLowerCase())?.id
    || null;
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showClientEditModal, setShowClientEditModal] = useState(false);
  const [sendBriefingOpen, setSendBriefingOpen] = useState(false);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [creditApplyOpen, setCreditApplyOpen] = useState(false);
  const [viewRespostas, setViewRespostas] = useState<{
    id: string;
    titulo: string;
    campos: any[];
  } | null>(null);
  const [formData, setFormData] = useState({
    date: appointment.date,
    time: appointment.time,
    title: appointment.title,
    type: appointment.type,
    status: appointment.status,
    description: appointment.description || '',
    packageId: appointment.packageId || '',
    paidAmount: appointment.paidAmount || 0
  });

  // Estado local para o input de data bruto
  const [dateInputValue, setDateInputValue] = useState(
    formatDateForInput(appointment.date)
  );
  // Buffer do input de hora — só commita após validação
  const [timeInputValue, setTimeInputValue] = useState(appointment.time);

  // Validação de conflito (ocupado/bloqueado)
  const { checkSlot } = useSlotAvailabilityCheck();
  const [conflictResult, setConflictResult] = useState<SlotCheckResult | null>(null);
  const [pendingChange, setPendingChange] = useState<{ date: Date; time: string } | null>(null);

  // Controller centralizado para handleSave — dialog é portal-mounted DENTRO do modal
  const { guard: saveGuard, dialogProps: saveDialogProps } = useAgendaConflict();

  // Habilitação visual de campos exclusivos do estado pendente (pacote, valor de entrada)
  const isEditable = formData.status === 'a confirmar';

  // Enhanced number input for paid amount
  const paidAmountInput = useNumberInput({
    value: formData.paidAmount,
    onChange: (value) => setFormData(prev => ({ ...prev, paidAmount: parseFloat(value) || 0 }))
  });

  // Manipular mudanças nos campos
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'paidAmount' ? parseFloat(value) || 0 : value
    }));
  };

  // Manipular seleção de pacote
  const handlePackageSelect = (packageId: string, packageData?: any) => {
    if (!isEditable) return;
    // Usa packageData se disponível, senão busca na lista
    const selectedPackage = packageData || pacotes.find(p => p.id === packageId);
    setFormData(prev => ({
      ...prev,
      packageId,
      type: selectedPackage?.nome || selectedPackage?.name || prev.type
    }));
  };

  // Manipular seleção de status — apenas local, persistência somente via botão Salvar
  const handleStatusSelect = (status: 'confirmado' | 'a confirmar') => {
    setFormData(prev => ({ ...prev, status }));
  };

  // Manipular input de data (somente atualiza o texto)
  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateInputValue(e.target.value);
  };

  // Aplicar mudança de data/hora após validação
  const applyDateTimeChange = (date: Date, time: string) => {
    setFormData(prev => ({ ...prev, date, time }));
    setDateInputValue(formatDateForInput(date));
    setTimeInputValue(time);
  };

  // Validar mudança de slot (data/hora). Retorna true se pode aplicar.
  const tryChangeSlot = (date: Date, time: string): boolean => {
    if (date.getTime() === formData.date.getTime() && time === formData.time) {
      return true;
    }
    const result = checkSlot({
      date,
      time,
      ignoreAppointmentId: appointment.id,
      targetStatus: formData.status,
    });
    if (result.kind === 'busy' || result.kind === 'blocked') {
      setPendingChange({ date, time });
      setConflictResult(result);
      return false;
    }
    applyDateTimeChange(date, time);
    return true;
  };

  // Validar e converter data quando o usuário sai do campo
  const handleDateInputBlur = () => {
    const parsedDate = safeParseInputDate(dateInputValue);
    if (parsedDate) {
      if (!tryChangeSlot(parsedDate, formData.time)) {
        setDateInputValue(formatDateForInput(formData.date));
      }
    } else {
      setDateInputValue(formatDateForInput(formData.date));
    }
  };

  // Validar hora ao sair do campo (usa buffer timeInputValue)
  const handleTimeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTimeInputValue(e.target.value);
  };

  const handleTimeBlur = () => {
    const newTime = timeInputValue;
    if (!newTime) {
      setTimeInputValue(formData.time);
      return;
    }
    if (newTime === formData.time) return;
    if (!tryChangeSlot(formData.date, newTime)) {
      setTimeInputValue(formData.time);
    }
  };


  // Sincronizar o input quando o campo recebe foco
  const handleDateInputFocus = () => {
    setDateInputValue(formatDateForInput(formData.date));
  };

  // Construir payload de salvamento (compartilhado entre auto-save e botão Salvar)
  const buildPayload = useCallback((data: typeof formData) => {
    const selectedPkg = pacotes.find(p => p.id === data.packageId);
    let packageCategory = '';
    if (selectedPkg && (selectedPkg as any).categorias) {
      packageCategory = (selectedPkg as any).categorias.nome || '';
    } else if (selectedPkg && (selectedPkg as any).categoria) {
      packageCategory = (selectedPkg as any).categoria;
    }
    return {
      id: appointment.id,
      date: formatDateForStorage(data.date),
      time: data.time,
      title: data.title,
      client: data.title,
      type: packageCategory || data.type,
      category: selectedPkg?.nome,
      status: data.status as 'confirmado' | 'a confirmar',
      description: data.description,
      packageId: data.packageId,
      paidAmount: data.paidAmount,
    };
  }, [appointment.id, pacotes]);

  // Modal totalmente manual — nenhum autosave. Persistência apenas pelo botão Salvar
  // (ou pelo onPersist explícito antes de abrir a cobrança).



  // Calcular se há mudanças não salvas (para confirmados que dependem do botão Salvar)
  const isDirty =
    formData.date.getTime() !== appointment.date.getTime() ||
    formData.time !== appointment.time ||
    timeInputValue !== appointment.time ||
    dateInputValue !== formatDateForInput(appointment.date) ||
    formData.title !== appointment.title ||
    formData.status !== appointment.status ||
    (formData.description || '') !== (appointment.description || '') ||
    (formData.packageId || '') !== (appointment.packageId || '') ||
    (formData.paidAmount || 0) !== (appointment.paidAmount || 0);

  // Salvar alterações (botão manual — usado por confirmados)
  const handleSave = async () => {
    // 1. Comitar inputs intermediários (data/hora podem estar no buffer sem blur)
    const parsedDate = safeParseInputDate(dateInputValue) ?? formData.date;
    const finalTime = timeInputValue || formData.time;

    // 2. Validar via guard centralizado (dialog renderizado dentro deste componente -> visível acima do Dialog)
    await saveGuard({
      date: parsedDate,
      time: finalTime,
      status: formData.status,
      ignoreAppointmentId: appointment.id,
      silentOnPending: formData.status !== 'confirmado',
      exec: async () => {
        // Atualizar formData ANTES de gravar para refletir o slot validado
        const nextFormData = { ...formData, date: parsedDate, time: finalTime };
        setFormData(nextFormData);
        setDateInputValue(formatDateForInput(parsedDate));
        setTimeInputValue(finalTime);
        await onSave(buildPayload(nextFormData));
      },
    });
  };

  const handleDeleteConfirm = (action: 'preserve' | 'refund' | 'remove') => {
    onDelete(appointment.id, action);
  };

  // Lazy load history when opened
  const handleHistoryToggle = (open: boolean) => {
    setHistoryOpen(open);
    if (open && !sessionDetails && workflowInfo.hasSession) {
      fetchSessionDetails();
    }
  };

  const selectedPackage = pacotes.find(p => p.id === formData.packageId);
  const valorTotal = selectedPackage?.valor || selectedPackage?.valor_base || selectedPackage?.valorVenda || 0;
  const saldo = valorTotal - formData.paidAmount;
  const isPendente = saldo > 0;

  return (
    <>
    <div className={cn("space-y-4 transition-all duration-200", (sendBriefingOpen || viewRespostas || showChargeModal) && "opacity-40 blur-[2px] pointer-events-none")}>
      {/* HEADER: Nome do cliente + data + status badge */}
      <div className="border-b border-lunar-border/30 pb-4">
        <div className="flex items-center gap-2">
          <h2 
            className="text-xl font-semibold text-lunar-text cursor-pointer hover:text-lunar-accent transition-colors"
            onClick={() => setShowClientEditModal(true)}
            title="Clique para editar cliente"
          >
            {formData.title}
          </h2>
          <button
            type="button"
            onClick={() => setShowClientEditModal(true)}
            className="text-lunar-muted hover:text-lunar-accent transition-colors"
            title="Editar cliente"
          >
            <UserRoundPen className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-lunar-muted mt-1">
          {format(formData.date, "EEEE, dd 'de' MMMM", { locale: ptBR })} às {formData.time}
        </p>
        <Badge 
          className={`mt-2 ${
            formData.status === 'confirmado' 
              ? 'bg-lunar-success/20 text-lunar-success border-lunar-success/30' 
              : 'bg-lunar-warning/20 text-lunar-warning border-lunar-warning/30'
          }`}
          variant="outline"
        >
          {formData.status === 'confirmado' ? '🟢 Confirmado' : '🟠 Pendente'}
        </Badge>
      </div>

      {/* BLOCO 1: Sessão */}
      <div className="bg-lunar-surface/30 rounded-lg p-4 space-y-3 border border-lunar-border/20">
        <h3 className="text-sm font-medium text-lunar-text flex items-center gap-2">
          <Calendar className="h-4 w-4 text-lunar-accent" /> Sessão
        </h3>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="date" className="text-xs text-lunar-muted">Data</Label>
            <Input 
              id="date" 
              name="date" 
              type="date" 
              value={dateInputValue} 
              onChange={handleDateInputChange}
              onBlur={handleDateInputBlur}
              onFocus={handleDateInputFocus}
              className="mt-1 h-9 text-sm" 
            />
          </div>
          <div>
            <Label htmlFor="time" className="text-xs text-lunar-muted">Horário</Label>
            <Input 
              id="time" 
              name="time" 
              type="time" 
              value={timeInputValue} 
              onChange={handleTimeInputChange}
              onBlur={handleTimeBlur}
              className="mt-1 h-9 text-sm" 
            />
          </div>
        </div>

        <div>
          <Label htmlFor="package" className="text-xs text-lunar-muted">Pacote</Label>
          <div className={`mt-1 ${!isEditable ? 'opacity-50 pointer-events-none' : ''}`}>
            <PackageSearchCombobox
              value={formData.packageId}
              onSelect={handlePackageSelect}
              placeholder="Buscar pacote..."
            />
          </div>
        </div>

        {/* Toggle de status - apenas para pendentes */}
        {formData.status === 'a confirmar' && (
          <div className="pt-2 border-t border-lunar-border/20">
            <div className="flex items-center justify-between">
              <span className="text-xs text-lunar-muted">Alterar status</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleStatusSelect('confirmado')}
                className="h-7 text-xs border-lunar-success text-lunar-success hover:bg-lunar-success/10"
              >
                Confirmar sessão
              </Button>
            </div>
          </div>
        )}

        {/* Aviso para confirmados - não pode reverter */}
        {formData.status === 'confirmado' && (
          <div className="pt-2 border-t border-lunar-border/20">
            <p className="text-xs text-lunar-muted italic flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              Agendamentos confirmados não podem ser revertidos. Se necessário, exclua e reagende.
            </p>
          </div>
        )}
      </div>

      {/* BLOCO 2: Financeiro */}
      <div className="bg-lunar-surface/30 rounded-lg p-4 space-y-3 border border-lunar-border/20">
        <h3 className="text-sm font-medium text-lunar-text flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-lunar-accent" /> Financeiro
        </h3>
        
        <div className="flex justify-between items-center text-sm">
          <span className="text-lunar-muted">Valor de entrada</span>
          <div className="flex items-center gap-1">
            <span className="text-lunar-muted text-xs">R$</span>
            <Input 
              id="paidAmount" 
              name="paidAmount" 
              type="number" 
              min="0" 
              step="0.01" 
              value={paidAmountInput.displayValue} 
              onChange={paidAmountInput.handleChange} 
              onFocus={paidAmountInput.handleFocus}
              className={`w-24 h-7 text-sm text-right ${!isEditable ? 'bg-muted cursor-not-allowed' : ''}`} 
              disabled={!isEditable} 
            />
          </div>
        </div>

        {formData.status === 'a confirmar' && resolvedClienteId && (
          <div className="pt-2 border-t border-lunar-border/20">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs gap-1.5"
              onClick={async () => {
                if (valorTotal <= 0 && formData.paidAmount <= 0) {
                  toast.info('Selecione um pacote ou informe um valor de entrada para cobrar.');
                  return;
                }

                // Pré-criar clientes_sessoes (idempotente) para garantir que cobrança/transação tenham vínculo
                try {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (user && appointment.sessionId) {
                    const { data: existing } = await supabase
                      .from('clientes_sessoes')
                      .select('id')
                      .eq('session_id', appointment.sessionId)
                      .eq('user_id', user.id)
                      .maybeSingle();

                    if (!existing) {
                      const { error: insertErr } = await supabase
                        .from('clientes_sessoes')
                        .insert({
                          user_id: user.id,
                          cliente_id: resolvedClienteId,
                          session_id: appointment.sessionId,
                          appointment_id: appointment.id,
                          data_sessao: formatDateForStorage(formData.date),
                          hora_sessao: formData.time,
                          categoria: formData.type || 'sessao',
                          pacote: selectedPackage?.nome || null,
                          status: 'agendado',
                          valor_total: valorTotal || formData.paidAmount || 0,
                          valor_base_pacote: valorTotal || 0,
                          valor_pago: 0,
                          tipo_registro: 'workflow',
                        });

                      if (insertErr) {
                        console.error('[AppointmentDetails] Erro ao pré-criar sessão:', insertErr);
                        toast.error('Erro ao preparar cobrança. Tente novamente.');
                        return;
                      }
                    }
                  }
                } catch (err) {
                  console.error('[AppointmentDetails] Erro inesperado pré-criando sessão:', err);
                  toast.error('Erro ao preparar cobrança.');
                  return;
                }

                // Garantir persistência silenciosa do pacote/valor antes de gerar a cobrança
                // (não fecha o modal — usa onPersist explícito)
                if (onPersist && !conflictResult) {
                  try {
                    await onPersist(buildPayload(formData));
                  } catch (err) {
                    console.error('[AppointmentDetails] Erro ao persistir antes da cobrança:', err);
                    toast.error(extractAgendaErrorMessage(err));
                    return;
                  }
                }


                setShowChargeModal(true);
              }}
            >
              <CreditCard className="h-3.5 w-3.5" />
              Cobrar cliente via link
            </Button>
            <p className="text-[10px] text-lunar-muted mt-1.5 text-center">
              Quando o cliente pagar, o agendamento será confirmado automaticamente.
            </p>
          </div>
        )}

        {formData.status === 'a confirmar' && !resolvedClienteId && (
          <div className="pt-2 border-t border-lunar-border/20">
            <p className="text-[11px] text-lunar-muted text-center italic">
              Vincule um cliente do CRM para habilitar cobrança via link.
            </p>
          </div>
        )}
      </div>

      {/* BLOCO 3: Observações */}
      <div className="bg-lunar-surface/30 rounded-lg p-4 border border-lunar-border/20">
        <h3 className="text-sm font-medium text-lunar-text flex items-center gap-2 mb-2">
          <FileText className="h-4 w-4 text-lunar-accent" /> Observações
        </h3>
        <Textarea 
          id="description" 
          name="description" 
          value={formData.description} 
          onChange={handleChange} 
          placeholder="Adicione notas sobre a sessão..." 
          className="min-h-[60px] text-sm resize-none" 
        />
      </div>

      {/* BLOCO 4: Briefing */}
      <div className="bg-lunar-surface/30 rounded-lg p-4 border border-lunar-border/20">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-lunar-text flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-lunar-accent" /> Briefing
          </h3>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setSendBriefingOpen(true)}
          >
            <Send className="h-3 w-3 mr-1" />
            Enviar
          </Button>
        </div>
        {sessionFormularios.length > 0 ? (
          <div className="space-y-1.5">
            {sessionFormularios.map((form) => (
              <div key={form.id} className="flex items-center justify-between text-sm py-1">
                <span className="text-lunar-text truncate">{form.titulo}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {form.status_envio === 'respondido' ? (
                    <>
                      <Badge className="bg-lunar-success/20 text-lunar-success border-lunar-success/30 text-[10px]">
                        ✅ Respondido
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => setViewRespostas({
                          id: form.id,
                          titulo: form.titulo,
                          campos: form.campos,
                        })}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <Badge className="bg-lunar-warning/20 text-lunar-warning border-lunar-warning/30 text-[10px]">
                      ⏳ Aguardando
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-lunar-muted">Nenhum briefing enviado</p>
        )}
      </div>

      {/* BLOCO 5: Histórico da Sessão (Colapsável) */}
      <Collapsible open={historyOpen} onOpenChange={handleHistoryToggle}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-4 text-sm font-medium text-lunar-text bg-lunar-surface/30 rounded-lg border border-lunar-border/20 hover:bg-lunar-surface/50 transition-colors">
          <ChevronRight className={`h-4 w-4 transition-transform ${historyOpen ? 'rotate-90' : ''}`} />
          <History className="h-4 w-4 text-lunar-accent" />
          Histórico da Sessão
          {!workflowInfo.hasSession && (
            <span className="ml-auto text-xs text-lunar-muted">(não confirmado)</span>
          )}
        </CollapsibleTrigger>
        
        <CollapsibleContent className="pt-2">
          <div className="bg-lunar-surface/20 rounded-lg p-4 border border-lunar-border/10 space-y-3">
            {loadingDetails ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-lunar-muted" />
                <span className="ml-2 text-sm text-lunar-muted">Carregando...</span>
              </div>
            ) : sessionDetails ? (
              <>
                {/* Dados do Pacote */}
                <div className="flex justify-between text-sm">
                  <span className="text-lunar-muted flex items-center gap-1">
                    <Package className="h-3 w-3" /> Pacote
                  </span>
                  <span className="text-lunar-text">{sessionDetails.pacote || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-lunar-muted">Categoria</span>
                  <span className="text-lunar-text">{sessionDetails.categoria}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-lunar-muted">Valor do Pacote</span>
                  <span className="text-lunar-text">R$ {sessionDetails.valorBasePacote.toFixed(2)}</span>
                </div>
                
                {/* Produtos (se houver) */}
                {sessionDetails.produtos && sessionDetails.produtos.length > 0 && (
                  <div className="border-t border-lunar-border/20 pt-2">
                    <span className="text-xs font-medium text-lunar-muted">Produtos</span>
                    {sessionDetails.produtos.map((p, idx) => (
                      <div key={idx} className="flex justify-between text-xs mt-1">
                        <span className="text-lunar-text">{p.nome} (x{p.quantidade})</span>
                        <span className="text-lunar-text">R$ {p.valorTotal.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Fotos extras */}
                {sessionDetails.qtdFotosExtra > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-lunar-muted">
                      Fotos extras ({sessionDetails.qtdFotosExtra}x)
                    </span>
                    <span className="text-lunar-text">R$ {sessionDetails.valorTotalFotoExtra.toFixed(2)}</span>
                  </div>
                )}

                {/* Desconto */}
                {sessionDetails.desconto > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-lunar-muted">Desconto</span>
                    <span className="text-lunar-error">- R$ {sessionDetails.desconto.toFixed(2)}</span>
                  </div>
                )}
                
                <Separator className="bg-lunar-border/20" />
                
                {/* Resumo financeiro */}
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-lunar-text">Total</span>
                  <span className="text-lunar-text">R$ {sessionDetails.valorTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-lunar-muted">Pago</span>
                  <span className="text-lunar-success">R$ {sessionDetails.valorPago.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-medium items-center">
                  <span className="text-lunar-muted">Pendente</span>
                  <div className="flex items-center gap-2">
                    {resolvedClienteId && appointment.sessionId && (
                      <ClientCreditBadge
                        clienteId={resolvedClienteId}
                        onClick={() => setCreditApplyOpen(true)}
                      />
                    )}
                    <span className={sessionDetails.valorTotal - sessionDetails.valorPago > 0 ? "text-lunar-warning" : "text-lunar-success"}>
                      R$ {Math.max(0, sessionDetails.valorTotal - sessionDetails.valorPago).toFixed(2)}
                    </span>
                  </div>
                </div>
              </>
            ) : workflowInfo.hasSession ? (
              <p className="text-sm text-lunar-muted text-center py-2">
                Erro ao carregar dados da sessão
              </p>
            ) : (
              <p className="text-sm text-lunar-muted text-center py-2">
                Sessão ainda não confirmada no Workflow
              </p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
      
      {/* Footer com botões */}
      <div className="flex justify-between pt-4 border-t border-lunar-border/20">
        <Button variant="destructive" onClick={() => setDeleteModalOpen(true)} className="text-xs h-9">
          Excluir
        </Button>
        <div className="flex items-center space-x-2">
          {isDirty && (
            <span className="text-[11px] text-lunar-warning self-center mr-1">
              Alterações não salvas
            </span>
          )}
          <Button variant="outline" onClick={onCancel} className="text-xs h-9">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!isDirty} className="text-xs h-9">
            Salvar
          </Button>
        </div>
      </div>
      </div>

      {/* Modais fora do container com blur */}
      <AppointmentDeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        appointmentData={{
          id: appointment.id,
          sessionId: appointment.sessionId,
          title: appointment.title,
          clientName: appointment.client,
          date: format(appointment.date, "dd/MM/yyyy", { locale: ptBR }),
          hasWorkflowSession: workflowInfo.hasSession,
          hasPayments: workflowInfo.hasPayments
        }}
      />

      <ClientEditModal
        open={showClientEditModal}
        onOpenChange={setShowClientEditModal}
        clienteId={resolvedClienteId || ''}
        clienteNome={appointment.client}
        onSuccess={(novoNome) => {
          if (novoNome) {
            setFormData(prev => ({ ...prev, title: novoNome }));
          }
        }}
      />

      <SendBriefingModal
        open={sendBriefingOpen}
        onOpenChange={setSendBriefingOpen}
        clienteId={resolvedClienteId || ''}
        clienteNome={appointment.client}
        clienteTelefone={appointment.whatsapp}
        sessionId={appointment.sessionId}
      />

      {viewRespostas && (
        <FormularioRespostasView
          open={!!viewRespostas}
          onOpenChange={(open) => !open && setViewRespostas(null)}
          formularioId={viewRespostas.id}
          titulo={viewRespostas.titulo}
          campos={viewRespostas.campos}
        />
      )}

      {showChargeModal && resolvedClienteId && (
        <ChargeModal
          isOpen={showChargeModal}
          onClose={() => setShowChargeModal(false)}
          clienteId={resolvedClienteId}
          clienteNome={appointment.client}
          clienteWhatsapp={appointment.whatsapp}
          sessionId={appointment.sessionId}
          valorSugerido={valorTotal > 0 ? valorTotal : (formData.paidAmount || 0)}
        />
      )}

      <SlotConflictDialog
        result={conflictResult}
        date={pendingChange?.date ?? formData.date}
        time={pendingChange?.time ?? formData.time}
        onClose={() => {
          setConflictResult(null);
          setPendingChange(null);
          setDateInputValue(formatDateForInput(formData.date));
        }}
        onUnblockAndContinue={async () => {
          if (!pendingChange) return;
          const slotId = conflictResult?.kind === 'blocked' ? conflictResult.slot.id : undefined;
          try {
            await allowBlockedWrite(slotId);
            applyDateTimeChange(pendingChange.date, pendingChange.time);
          } catch (err) {
            console.error('[AppointmentDetails] desbloqueio falhou', err);
            toast.error('Falha ao desbloquear horário');
          } finally {
            setConflictResult(null);
            setPendingChange(null);
          }
        }}
        onContinueAnyway={() => {
          if (pendingChange) applyDateTimeChange(pendingChange.date, pendingChange.time);
          setConflictResult(null);
          setPendingChange(null);
        }}
      />

      {/* Dialog do guard centralizado (usado pelo handleSave em confirmados) */}
      <SlotConflictDialog {...saveDialogProps} />

      {resolvedClienteId && appointment.sessionId && sessionDetails && (
        <ClientCreditApplyModal
          isOpen={creditApplyOpen}
          onClose={() => setCreditApplyOpen(false)}
          clienteId={resolvedClienteId}
          sessionId={appointment.sessionId}
          restanteSessao={Math.max(0, sessionDetails.valorTotal - sessionDetails.valorPago)}
          onApplied={() => fetchSessionDetails?.()}
        />
      )}
    </>

  );
}
