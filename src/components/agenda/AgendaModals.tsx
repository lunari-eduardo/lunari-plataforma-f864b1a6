import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AppointmentForm from "./AppointmentForm";
import AppointmentDetails from "./AppointmentDetails";
import EditOrcamentoModal from "@/components/orcamentos/EditOrcamentoModal";
import BudgetAppointmentDetails from "./BudgetAppointmentDetails";
import AvailabilityConfigModal from "./AvailabilityConfigModal";
import ShareAvailabilityModal from "./ShareAvailabilityModal";
import { Appointment } from "@/hooks/useAgenda";
import { Orcamento } from "@/types/orcamentos";

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
  onDeleteAppointment: (id: string, preservePayments?: boolean) => void;
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
  onDeleteAppointment,
  onSaveBudgetAppointment,
  onViewFullBudget
}: AgendaModalsProps) {
  
  return (
    <>
      {/* Appointment Form Modal */}
      <Dialog open={isAppointmentDialogOpen} onOpenChange={setIsAppointmentDialogOpen}>
        <DialogContent className="sm:max-w-[500px] bg-background border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">
              {editingAppointment ? 'Editar Agendamento' : 'Novo Agendamento'}
            </DialogTitle>
          </DialogHeader>

          <AppointmentForm
            initialDate={selectedSlot?.date || editingAppointment?.date}
            initialTime={selectedSlot?.time || editingAppointment?.time}
            appointment={editingAppointment}
            onSave={onSaveAppointment}
            onCancel={() => setIsAppointmentDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Appointment Details Modal */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[500px] bg-background border-border">
          {viewingAppointment && (
            <AppointmentDetails
              appointment={viewingAppointment}
              onSave={onSaveAppointment}
              onCancel={() => setIsDetailsOpen(false)}
              onDelete={onDeleteAppointment}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Budget Appointment Details Modal */}
      <Dialog open={isBudgetAppointmentModalOpen} onOpenChange={setIsBudgetAppointmentModalOpen}>
        <DialogContent className="sm:max-w-[600px] bg-background border-border">
          {selectedBudgetAppointment && (
            <BudgetAppointmentDetails
              appointment={selectedBudgetAppointment.appointment}
              budget={selectedBudgetAppointment.budget}
              onSave={onSaveBudgetAppointment}
              onCancel={() => setIsBudgetAppointmentModalOpen(false)}
              onViewFullBudget={onViewFullBudget}
              onDelete={onDeleteAppointment}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Budget Edit Modal */}
      <EditOrcamentoModal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        orcamento={selectedBudget}
      />

      {/* Availability Config Modal */}
      <AvailabilityConfigModal
        isOpen={isAvailabilityModalOpen}
        onClose={() => setIsAvailabilityModalOpen(false)}
        date={selectedSlot?.date || new Date()}
        initialTime={selectedSlot?.time}
      />

      {/* Share Availability Modal */}
      <ShareAvailabilityModal 
        isOpen={isShareModalOpen} 
        onClose={() => setIsShareModalOpen(false)} 
        period={{ day: selectedSlot?.date || new Date() }} 
        mode="day" 
      />
    </>
  );
}