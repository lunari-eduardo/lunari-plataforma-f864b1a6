import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatDateForInput, safeParseInputDate, formatDateForStorage } from '@/utils/dateUtils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/workflow/StatusBadge";
import { toast } from 'sonner';
import { useNumberInput } from '@/hooks/useNumberInput';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { useAppointmentWorkflowInfo } from '@/hooks/useAppointmentWorkflowInfo';
import { AppointmentDeleteConfirmModal } from './AppointmentDeleteConfirmModal';
import { Appointment } from '@/hooks/useAgenda';

interface AppointmentDetailsProps {
  appointment: Appointment;
  onSave: (appointmentData: any) => void;
  onCancel: () => void;
  onDelete: (id: string, preservePayments?: boolean) => void;
}


// Lista de status disponíveis
const availableStatus = [{
  value: 'a confirmar',
  label: 'Pendente'
}, {
  value: 'confirmado',
  label: 'Confirmado'
}];

export default function AppointmentDetails({
  appointment,
  onSave,
  onCancel,
  onDelete
}: AppointmentDetailsProps) {
  const { pacotes } = useOrcamentos();
  const { workflowInfo } = useAppointmentWorkflowInfo(appointment.id);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
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
    const {
      name,
      value
    } = e.target;
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
    
    // ✅ FASE 2: Buscar categoria do pacote (se disponível)
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
      type: packageCategory || formData.type,  // ✅ FASE 2: type = CATEGORIA (não nome do pacote)
      category: selectedPackage?.nome,  // ✅ FASE 2: category = NOME DO PACOTE
      status: formData.status as 'confirmado' | 'a confirmar',
      description: formData.description,
      packageId: formData.packageId,
      paidAmount: formData.paidAmount
    };
    
    console.log('💾 [AppointmentDetails] Salvando com:', {
      type: appointmentData.type,
      category: appointmentData.category,
      packageId: appointmentData.packageId
    });
    
    onSave(appointmentData);
    toast.success('Agendamento atualizado com sucesso');
  };

  const handleDeleteConfirm = (preservePayments: boolean) => {
    onDelete(appointment.id, preservePayments);
    toast.success(preservePayments ? 'Agendamento cancelado - histórico preservado' : 'Agendamento excluído completamente');
  };

  const selectedPackage = pacotes.find(p => p.id === formData.packageId);
  return <div className="space-y-4">
      <div className="text-center mb-4">
        <h2 className="text-lg font-medium text-lunar-text">Detalhes do Agendamento</h2>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="title" className="text-xs font-medium text-lunar-text">Cliente</Label>
          <Input id="title" name="title" value={formData.title} className="mt-1 bg-muted" placeholder="Nome do cliente" disabled readOnly />
          
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="date" className="text-xs font-medium text-lunar-text">Data e Hora de Início</Label>
            <div className="mt-1 flex space-x-2">
              <Input 
                id="date" 
                name="date" 
                type="date" 
                value={dateInputValue} 
                onChange={handleDateInputChange}
                onBlur={handleDateInputBlur}
                onFocus={handleDateInputFocus}
                className="flex-1" 
              />
              <Input id="time" name="time" type="time" value={formData.time} onChange={handleChange} className="flex-1" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="package" className="text-xs font-medium text-lunar-text">Pacote</Label>
            <Select value={formData.packageId} onValueChange={handlePackageSelect} disabled={!isEditable}>
              <SelectTrigger className={`mt-1 ${!isEditable ? 'bg-muted cursor-not-allowed' : ''}`}>
                <SelectValue placeholder="Selecionar pacote" />
              </SelectTrigger>
              <SelectContent>
                {pacotes.map(pkg => <SelectItem key={pkg.id} value={pkg.id}>
                    {pkg.nome} - R$ {(pkg.valor || pkg.valor_base || pkg.valorVenda || 0).toFixed(2)}
                  </SelectItem>)}
              </SelectContent>
            </Select>
            {!isEditable}
          </div>
          
          <div>
            <Label htmlFor="status" className="text-xs font-medium text-lunar-text">Status</Label>
            <div className="mt-1 flex gap-2">
              {availableStatus.map(status => (
                <Button
                  key={status.value}
                  type="button"
                  variant={formData.status === status.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleStatusSelect(status.value as 'confirmado' | 'a confirmar')}
                  className={`flex-1 text-xs h-8 ${
                    formData.status === status.value
                      ? status.value === 'a confirmar'
                        ? 'bg-lunar-error text-primary-foreground border-lunar-error hover:opacity-90'
                        : 'bg-lunar-success text-primary-foreground border-lunar-success hover:opacity-90'
                      : status.value === 'a confirmar'
                        ? 'border-lunar-error text-lunar-error hover:bg-lunar-error/10'
                        : 'border-lunar-success text-lunar-success hover:bg-lunar-success/10'
                  }`}
                >
                  {status.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="totalValue" className="text-xs font-medium text-lunar-text">Valor Total</Label>
            <Input id="totalValue" type="number" value={selectedPackage?.valor || selectedPackage?.valor_base || selectedPackage?.valorVenda || 0} className="mt-1 bg-lunar-surface/50" disabled />
          </div>
          
          <div>
            <Label htmlFor="paidAmount" className="text-xs font-medium text-lunar-text">Valor Pago</Label>
             <Input 
               id="paidAmount" 
               name="paidAmount" 
               type="number" 
               min="0" 
               step="0.01" 
               value={paidAmountInput.displayValue} 
               onChange={paidAmountInput.handleChange} 
               onFocus={paidAmountInput.handleFocus}
               className={`mt-1 ${!isEditable ? 'bg-muted cursor-not-allowed' : ''}`} 
               placeholder="" 
               disabled={!isEditable} 
             />
            {!isEditable}
          </div>
        </div>
        
        <div>
          <Label htmlFor="description" className="text-xs font-medium text-lunar-text">Observações</Label>
          <Textarea id="description" name="description" value={formData.description} onChange={handleChange} placeholder="Detalhes da sessão..." className="mt-1 min-h-[80px]" />
        </div>
      </div>
      
      <div className="flex justify-between pt-4">
        <Button variant="destructive" onClick={() => setDeleteModalOpen(true)} className="text-xs">
          Excluir
        </Button>
        <div className="space-x-2">
          <Button variant="outline" onClick={onCancel} className="text-xs">
            Cancelar
          </Button>
          <Button onClick={handleSave} className="text-xs">
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
    </div>;
}
