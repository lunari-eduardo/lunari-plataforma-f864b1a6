import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatDateForInput, safeParseInputDate, formatDateForStorage } from '@/utils/dateUtils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from 'sonner';
import { useNumberInput } from '@/hooks/useNumberInput';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { useAppointmentWorkflowInfo } from '@/hooks/useAppointmentWorkflowInfo';
import { AppointmentDeleteConfirmModal } from './AppointmentDeleteConfirmModal';
import { Appointment } from '@/hooks/useAgenda';
import { Calendar, DollarSign, FileText, History, ChevronRight, Loader2, Package } from 'lucide-react';

interface AppointmentDetailsProps {
  appointment: Appointment;
  onSave: (appointmentData: any) => void;
  onCancel: () => void;
  onDelete: (id: string, preservePayments?: boolean) => void;
}

export default function AppointmentDetails({
  appointment,
  onSave,
  onCancel,
  onDelete
}: AppointmentDetailsProps) {
  const { pacotes } = useOrcamentos();
  const { workflowInfo, sessionDetails, loadingDetails, fetchSessionDetails } = useAppointmentWorkflowInfo(appointment.id);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
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
  const handlePackageSelect = (packageId: string) => {
    if (!isEditable) return;
    const selectedPackage = pacotes.find(p => p.id === packageId);
    setFormData(prev => ({
      ...prev,
      packageId,
      type: selectedPackage?.nome || prev.type
    }));
  };

  // Manipular seleção de status
  const handleStatusSelect = (status: 'confirmado' | 'a confirmar') => {
    setFormData(prev => ({
      ...prev,
      status
    }));
  };

  // Manipular input de data (somente atualiza o texto)
  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateInputValue(e.target.value);
  };

  // Validar e converter data quando o usuário sai do campo
  const handleDateInputBlur = () => {
    const parsedDate = safeParseInputDate(dateInputValue);
    if (parsedDate) {
      setFormData(prev => ({ ...prev, date: parsedDate }));
    } else {
      // Se inválida, volta ao valor anterior
      setDateInputValue(formatDateForInput(formData.date));
    }
  };

  // Sincronizar o input quando o campo recebe foco
  const handleDateInputFocus = () => {
    setDateInputValue(formatDateForInput(formData.date));
  };

  // Salvar alterações
  const handleSave = () => {
    const selectedPackage = pacotes.find(p => p.id === formData.packageId);
    
    // Buscar categoria do pacote (se disponível)
    let packageCategory = '';
    if (selectedPackage && (selectedPackage as any).categorias) {
      packageCategory = (selectedPackage as any).categorias.nome || '';
    } else if (selectedPackage && (selectedPackage as any).categoria) {
      packageCategory = (selectedPackage as any).categoria;
    }
    
    const appointmentData = {
      id: appointment.id,
      date: formatDateForStorage(formData.date),
      time: formData.time,
      title: formData.title,
      client: formData.title,
      type: packageCategory || formData.type,
      category: selectedPackage?.nome,
      status: formData.status as 'confirmado' | 'a confirmar',
      description: formData.description,
      packageId: formData.packageId,
      paidAmount: formData.paidAmount
    };
    
    onSave(appointmentData);
    toast.success('Agendamento atualizado com sucesso');
  };

  const handleDeleteConfirm = (preservePayments: boolean) => {
    onDelete(appointment.id, preservePayments);
    toast.success(preservePayments ? 'Agendamento cancelado - histórico preservado' : 'Agendamento excluído completamente');
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
    <div className="space-y-4">
      {/* HEADER: Nome do cliente + data + status badge */}
      <div className="border-b border-lunar-border/30 pb-4">
        <h2 className="text-xl font-semibold text-lunar-text">{formData.title}</h2>
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
          <Select value={formData.packageId} onValueChange={handlePackageSelect} disabled={!isEditable}>
            <SelectTrigger className={`mt-1 h-9 text-sm ${!isEditable ? 'bg-muted cursor-not-allowed' : ''}`}>
              <SelectValue placeholder="Selecionar pacote" />
            </SelectTrigger>
            <SelectContent>
              {pacotes.map(pkg => (
                <SelectItem key={pkg.id} value={pkg.id}>
                  {pkg.nome} - R$ {(pkg.valor || pkg.valor_base || pkg.valorVenda || 0).toFixed(2)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Toggle de status */}
        <div className="pt-2 border-t border-lunar-border/20">
          <div className="flex items-center justify-between">
            <span className="text-xs text-lunar-muted">Alterar status</span>
            {formData.status === 'a confirmar' ? (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleStatusSelect('confirmado')}
                className="h-7 text-xs border-lunar-success text-lunar-success hover:bg-lunar-success/10"
              >
                Confirmar sessão
              </Button>
            ) : (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => handleStatusSelect('a confirmar')}
                className="h-7 text-xs text-lunar-muted hover:text-lunar-warning"
              >
                Voltar para pendente
              </Button>
            )}
          </div>
        </div>
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

      {/* BLOCO 4: Histórico da Sessão (Colapsável) */}
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
          <Button variant="outline" onClick={onCancel} className="text-xs h-9">
            Cancelar
          </Button>
          <Button onClick={handleSave} className="text-xs h-9">
            Salvar
          </Button>
        </div>
      </div>

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
    </div>
  );
}
