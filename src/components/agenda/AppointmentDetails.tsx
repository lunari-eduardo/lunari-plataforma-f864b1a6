import { useState, useCallback, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useAppointmentAutosave } from '@/hooks/useAppointmentAutosave';
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
import { useClientesRealtime } from '@/hooks/useClientesRealtime';
import { supabase } from '@/integrations/supabase/client';
import { Appointment } from '@/hooks/useAgenda';
import PackageSearchCombobox from './PackageSearchCombobox';
import { Calendar, DollarSign, FileText, History, ChevronRight, Loader2, Package, AlertCircle, UserRoundPen, ClipboardList, Eye, Send, CreditCard, Check, CloudOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSlotAvailabilityCheck, type SlotCheckResult } from '@/hooks/useSlotAvailabilityCheck';
import { SlotConflictDialog } from './SlotConflictDialog';
import { allowBlockedWrite } from '@/utils/agendaSlotGuard';

interface AppointmentDetailsProps {
  appointment: Appointment;
  onSave: (appointmentData: any) => void;
  onAutoSave?: (appointmentData: any) => void | Promise<void>;
  onCancel: () => void;
  onDelete: (id: string, action?: 'preserve' | 'refund' | 'remove') => void;
}

export default function AppointmentDetails({
  appointment,
  onSave,
  onAutoSave,
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

  // Validação de conflito (ocupado/bloqueado)
  const { checkSlot } = useSlotAvailabilityCheck();
  const [conflictResult, setConflictResult] = useState<SlotCheckResult | null>(null);
  const [pendingChange, setPendingChange] = useState<{ date: Date; time: string } | null>(null);

  // Determinar se os campos podem ser editados
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

  // Manipular seleção de status
  const handleStatusSelect = async (status: 'confirmado' | 'a confirmar') => {
    const next = { ...formData, status };
    setFormData(next);
    // Quando confirmar, autosave fica disabled — salvar imediatamente para garantir persistência
    if (status === 'confirmado') {
      try {
        await onSave(buildPayload(next));
      } catch (err) {
        console.error('[AppointmentDetails] Erro ao confirmar:', err);
      }
    }
  };

  // Manipular input de data (somente atualiza o texto)
  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateInputValue(e.target.value);
  };

  // Aplicar mudança de data/hora após validação
  const applyDateTimeChange = (date: Date, time: string) => {
    setFormData(prev => ({ ...prev, date, time }));
    setDateInputValue(formatDateForInput(date));
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

  // Validar hora ao sair do campo
  const handleTimeBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    if (!newTime || newTime === formData.time) return;
    if (!tryChangeSlot(formData.date, newTime)) {
      setFormData(prev => ({ ...prev, time: prev.time }));
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

  // Auto-save (apenas para pendentes; pausado enquanto há dialog de conflito aberto)
  const { status: autosaveStatus, flushNow } = useAppointmentAutosave({
    data: formData,
    enabled: isEditable && !conflictResult,
    delay: 800,
    buildPayload,
    onSave: async (payload) => {
      await (onAutoSave ?? onSave)(payload);
    },
  });

  // Manter ref atualizada para flush no unmount
  const flushNowRef = useRef(flushNow);
  useEffect(() => { flushNowRef.current = flushNow; }, [flushNow]);
  useEffect(() => {
    return () => {
      // Ao desmontar (modal fechado), garantir persistência de qualquer alteração pendente
      flushNowRef.current?.();
    };
  }, []);

  // Salvar alterações (botão manual)
  const handleSave = async () => {
    await onSave(buildPayload(formData));
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
          {isEditable && autosaveStatus !== 'idle' && (
            <span
              className={cn(
                "ml-auto flex items-center gap-1 text-[11px] transition-opacity",
                autosaveStatus === 'saving' && "text-lunar-muted",
                autosaveStatus === 'saved' && "text-lunar-success",
                autosaveStatus === 'error' && "text-lunar-error"
              )}
              title={
                autosaveStatus === 'error'
                  ? 'Falha ao salvar — suas alterações ainda não foram persistidas'
                  : undefined
              }
            >
              {autosaveStatus === 'saving' && (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Salvando…
                </>
              )}
              {autosaveStatus === 'saved' && (
                <>
                  <Check className="h-3 w-3" />
                  Salvo
                </>
              )}
              {autosaveStatus === 'error' && (
                <>
                  <CloudOff className="h-3 w-3" />
                  Erro ao salvar
                  <button
                    type="button"
                    onClick={() => flushNow()}
                    className="underline ml-1"
                  >
                    tentar novamente
                  </button>
                </>
              )}
            </span>
          )}
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
              value={formData.time} 
              onChange={handleChange} 
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

                // Garantir persistência do pacote/valor antes de gerar a cobrança
                try { await flushNow(); } catch (_) { /* erro já tratado no hook */ }

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
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-lunar-muted">Pendente</span>
                  <span className={sessionDetails.valorTotal - sessionDetails.valorPago > 0 ? "text-lunar-warning" : "text-lunar-success"}>
                    R$ {Math.max(0, sessionDetails.valorTotal - sessionDetails.valorPago).toFixed(2)}
                  </span>
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
        <div className="space-x-2">
          {isEditable ? (
            <Button
              onClick={async () => {
                try { await flushNow(); } catch (_) {}
                onCancel();
              }}
              className="text-xs h-9"
            >
              Fechar
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={onCancel} className="text-xs h-9">
                Cancelar
              </Button>
              <Button onClick={handleSave} className="text-xs h-9">
                Salvar
              </Button>
            </>
          )}
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
    </>
  );
}
