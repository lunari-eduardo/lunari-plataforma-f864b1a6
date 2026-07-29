import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AppointmentForm from "./AppointmentForm";
import AppointmentDetails from "./AppointmentDetails";
import BudgetAppointmentDetails from "./BudgetAppointmentDetails";
import AvailabilityConfigModal from "./AvailabilityConfigModal";
import ShareAvailabilityModal from "./ShareAvailabilityModal";
import { Appointment } from "@/modules/agenda/presentation";
import { Orcamento } from "@/types/orcamento";
import { cn } from '@/lib/utils';
import { dialogSize, DIALOG_SHELL, DIALOG_BODY, DIALOG_TITLE_CLS } from '@/lib/dialogTokens';

interface AgendaModalsProps {
  // Modal states
  isAppointmentDialogOpen: boolean;
  isDetailsOpen: boolean;
  isBudgetModalOpen: boolean;
  isBudgetAppointmentModalOpen: boolean;
  isAvailabilityModalOpen: boolean;
  isShareModalOpen: boolean;
  
  // Selection states
  selectedSlot: { date: Date; time?: string; } | null;
  editingAppointment: Appointment | null;
  viewingAppointment: Appointment | null;
  selectedBudget: Orcamento | null;
  selectedBudgetAppointment: { appointment: Appointment; budget: Orcamento | null; } | null;
  
  // Modal setters
  setIsAppointmentDialogOpen: (open: boolean) => void;
  setIsDetailsOpen: (open: boolean) => void;
  setIsBudgetModalOpen: (open: boolean) => void;
  setIsBudgetAppointmentModalOpen: (open: boolean) => void;
  setIsAvailabilityModalOpen: (open: boolean) => void;
  setIsShareModalOpen: (open: boolean) => void;
  
  // Event handlers
  onSaveAppointment: (appointmentData: any) => void;
  onPersistAppointment?: (appointmentData: any) => void | Promise<void>;
  onDeleteAppointment: (id: string, action?: 'preserve' | 'refund' | 'remove') => void;
  onSaveBudgetAppointment: (data: { date: Date; time: string; description?: string; }) => void;
  onViewFullBudget: () => void;
}

export default function AgendaModals({
  // Modal states
  isAppointmentDialogOpen,
  isDetailsOpen,
  isBudgetModalOpen,
  isBudgetAppointmentModalOpen,
  isAvailabilityModalOpen,
  isShareModalOpen,
  
  // Selection states
  selectedSlot,
  editingAppointment,
  viewingAppointment,
  selectedBudget,
  selectedBudgetAppointment,
  
  // Modal setters
  setIsAppointmentDialogOpen,
  setIsDetailsOpen,
  setIsBudgetModalOpen,
  setIsBudgetAppointmentModalOpen,
  setIsAvailabilityModalOpen,
  setIsShareModalOpen,
  
  // Event handlers
  onSaveAppointment,
  onPersistAppointment,
  onDeleteAppointment,
  onSaveBudgetAppointment,
  onViewFullBudget
}: AgendaModalsProps) {
  
  return (
    <>
      {/* Appointment Form Modal */}
      <Dialog open={isAppointmentDialogOpen} onOpenChange={setIsAppointmentDialogOpen}>
        <DialogContent className={cn(dialogSize('md'), DIALOG_SHELL)}>
          <DialogHeader>
            <DialogTitle className={DIALOG_TITLE_CLS}>
              {editingAppointment ? 'Editar Agendamento' : 'Novo Agendamento'}
            </DialogTitle>
          </DialogHeader>

          <div className={cn(DIALOG_BODY, 'pr-1')}>
            <AppointmentForm
              initialDate={selectedSlot?.date || editingAppointment?.date}
              initialTime={selectedSlot?.time || editingAppointment?.time}
              appointment={editingAppointment}
              onSave={onSaveAppointment}
              onCancel={() => setIsAppointmentDialogOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Appointment Details Modal */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className={cn(dialogSize('md'), DIALOG_SHELL)}>
          {viewingAppointment && (
            <div className={cn(DIALOG_BODY, 'pr-1')}>
            <AppointmentDetails
              appointment={viewingAppointment}
              onSave={onSaveAppointment}
              onPersist={onPersistAppointment}
              onCancel={() => setIsDetailsOpen(false)}
              onDelete={onDeleteAppointment}
            />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Budget Appointment Details Modal */}
      <Dialog open={isBudgetAppointmentModalOpen} onOpenChange={setIsBudgetAppointmentModalOpen}>
        <DialogContent className={cn(dialogSize('lg'), DIALOG_SHELL)}>
          {selectedBudgetAppointment && (
            <div className={cn(DIALOG_BODY, 'pr-1')}>
            <BudgetAppointmentDetails
              appointment={selectedBudgetAppointment.appointment}
              budget={selectedBudgetAppointment.budget}
              onSave={onSaveBudgetAppointment}
              onCancel={() => setIsBudgetAppointmentModalOpen(false)}
              onViewFullBudget={onViewFullBudget}
              onDelete={onDeleteAppointment}
            />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Budget Edit Modal - Disabled */}
      {selectedBudget && (
        <Dialog open={isBudgetModalOpen} onOpenChange={setIsBudgetModalOpen}>
          <DialogContent className={cn(dialogSize('md'), DIALOG_SHELL)}>
            <DialogHeader>
              <DialogTitle className={DIALOG_TITLE_CLS}>Orçamento - Sistema Desabilitado</DialogTitle>
            </DialogHeader>
            <div className="p-4 text-center text-muted-foreground">
              O sistema de orçamentos foi removido. Use o CRM e Workflow para gerenciar clientes e projetos.
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Availability Config Modal */}
      <AvailabilityConfigModal
        isOpen={isAvailabilityModalOpen}
        onClose={() => setIsAvailabilityModalOpen(false)}
        date={selectedSlot?.date && selectedSlot.date instanceof Date && !isNaN(selectedSlot.date.getTime()) 
          ? selectedSlot.date 
          : new Date()}
        initialTime={selectedSlot?.time}
      />

      {/* Share Availability Modal */}
      <ShareAvailabilityModal 
        isOpen={isShareModalOpen} 
        onClose={() => setIsShareModalOpen(false)} 
        period={{ 
          day: selectedSlot?.date && selectedSlot.date instanceof Date && !isNaN(selectedSlot.date.getTime()) 
            ? selectedSlot.date 
            : new Date() 
        }} 
        mode="day" 
      />
    </>
  );
}