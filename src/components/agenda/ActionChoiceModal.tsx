import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDateForStorage } from '@/utils/dateUtils';
interface ActionChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  time: string;
  onCreateAppointment: () => void;
}
export default function ActionChoiceModal({
  isOpen,
  onClose,
  date,
  time,
  onCreateAppointment
}: ActionChoiceModalProps) {
  const navigate = useNavigate();
  const handleCreateBudget = () => {
    const dateStr = formatDateForStorage(date);
    navigate(`/orcamentos?data=${dateStr}&hora=${time}`);
    onClose();
  };
  const handleCreateAppointment = () => {
    onCreateAppointment();
    onClose();
  };
  return <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>O que deseja criar para este horário?</DialogTitle>
          <DialogDescription>
            Escolha o tipo de compromisso que deseja agendar para {date.toLocaleDateString('pt-BR')} às {time}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-4">
          <Button onClick={handleCreateAppointment} className="flex items-center gap-2 h-12 justify-start" variant="outline">
            <Calendar className="h-5 w-5 text-green-600" />
            <div className="text-left">
              <div className="font-medium">Novo Agendamento</div>
              <div className="text-xs text-muted-foreground">Cria agendamento na agenda</div>
            </div>
          </Button>

          <Button onClick={handleCreateBudget} className="flex items-center gap-2 h-12 justify-start" variant="outline">
            <DollarSign className="h-5 w-5 text-blue-600" />
            <div className="text-left">
              <div className="font-medium">Novo Orçamento</div>
              <div className="text-xs text-muted-foreground">Cria um orçamento com esse horário</div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>;
}