import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar, DollarSign, Settings, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDateForStorage } from '@/utils/dateUtils';
import { useAvailability } from '@/hooks/useAvailability';
import { toast } from 'sonner';
interface ActionChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  time: string;
  onCreateAppointment: () => void;
  onConfigureAvailability: () => void;
}
export default function ActionChoiceModal({
  isOpen,
  onClose,
  date,
  time,
  onCreateAppointment,
  onConfigureAvailability
}: ActionChoiceModalProps) {
  const navigate = useNavigate();
  const {
    availability
  } = useAvailability();

  // Formata "HH:mm" para "HHh" ou "HHh mmmin"
  const formatTimeBr = (t: string) => {
    const [hh, mm] = t.split(':');
    return mm === '00' ? `${hh}h` : `${hh}h ${mm}min`;
  };
  const handleCreateBudget = () => {
    const dateStr = formatDateForStorage(date);
    navigate(`/orcamentos?data=${dateStr}&hora=${time}`);
    onClose();
  };
  const handleCreateAppointment = () => {
    onCreateAppointment();
    onClose();
  };
  const handleConfigureAvailability = () => {
    onConfigureAvailability();
    onClose();
  };
  const handleShareDay = async () => {
    const ds = formatDateForStorage(date);
    const slots = availability.filter(a => a.date === ds).map(a => a.time).sort();
    if (slots.length === 0) {
      toast.error('Não há disponibilidades para este dia.');
      return;
    }
    const diaStr = date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long'
    });
    const semanaStr = date.toLocaleDateString('pt-BR', {
      weekday: 'long'
    });
    const times = slots.map(formatTimeBr).join('\n');
    const text = `No dia ${diaStr}, ${semanaStr}, tenho os seguintes horários:\n\n${times}\n\nQual fica melhor para você?`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Horários disponíveis',
          text
        });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success('Horários copiados para a área de transferência');
      }
    } catch (e) {
      await navigator.clipboard.writeText(text);
      toast.success('Horários copiados para a área de transferência');
    }
  };
  return <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              
              <DialogDescription className="text-sm font-semibold text-sky-950">
                Escolha o tipo de compromisso que deseja agendar para {date.toLocaleDateString('pt-BR')} às {time}.
              </DialogDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={handleShareDay} aria-label="Compartilhar horários do dia" title="Compartilhar horários do dia" className="px-[8px] py-[2px] my-[9px] text-sky-950">
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-4">
          <Button onClick={handleConfigureAvailability} className="flex items-center gap-2 h-12 justify-start" variant="outline">
            <Settings className="h-5 w-5 text-purple-600" />
              <div className="text-left">
                <div className="font-medium">Configurar Disponibilidade</div>
                <div className="text-xs text-muted-foreground">Defina horários disponíveis e duração</div>
              </div>
          </Button>


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