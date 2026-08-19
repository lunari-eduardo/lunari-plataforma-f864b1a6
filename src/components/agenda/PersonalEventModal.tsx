import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Clock, Calendar, Trash2 } from 'lucide-react';
import { formatDateForInput, safeParseInputDate } from '@/utils/dateUtils';
import type { Appointment } from '@/modules/agenda/presentation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PersonalEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: Appointment | null;
  initialDate?: Date;
  initialTime?: string;
  onSave: (data: any) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
}

const QUICK_SUGGESTIONS = [
  'Médico',
  'Dentista',
  'Compromisso pessoal',
  'Compromisso familiar',
  'Escola / Filhos',
  'Treino / Academia',
  'Viagem / Deslocamento',
  'Manutenção de equipamentos',
];

export function PersonalEventModal({
  open,
  onOpenChange,
  event = null,
  initialDate,
  initialTime,
  onSave,
  onDelete,
}: PersonalEventModalProps) {
  const isEdit = !!event;

  const [title, setTitle] = useState('');
  const [dateInput, setDateInput] = useState(() => formatDateForInput(initialDate || new Date()));
  const [timeInput, setTimeInput] = useState(initialTime || '10:00');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (event) {
      setTitle(event.title || '');
      setDateInput(formatDateForInput(event.date || new Date()));
      setTimeInput(event.time || '10:00');
      setDurationMinutes(String(event.durationMinutes || '60'));
      setDescription(event.description || '');
    } else {
      setTitle('');
      setDateInput(formatDateForInput(initialDate || new Date()));
      setTimeInput(initialTime || '10:00');
      setDurationMinutes('60');
      setDescription('');
    }
  }, [open, event, initialDate, initialTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    try {
      const parsedDate = safeParseInputDate(dateInput) || new Date();
      const payload: any = {
        title: title.trim(),
        date: parsedDate,
        time: timeInput || '10:00',
        type: 'pessoal',
        agendaType: 'personal',
        durationMinutes: parseInt(durationMinutes, 10) || 60,
        status: 'confirmado',
        description: description.trim(),
        client: title.trim(),
      };

      if (isEdit && event) {
        payload.id = event.id;
      }

      await onSave(payload);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-purple-500/15 flex items-center justify-center text-purple-500 shrink-0">
              <User className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                {isEdit ? 'Editar evento pessoal' : 'Novo evento pessoal'}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Compromissos pessoais e bloqueios de agenda
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Título */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foreground">
              Título do compromisso *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Médico, Escola, Viagem..."
              className="h-10 text-sm"
              autoFocus
              required
            />

            {/* Sugestões rápidas */}
            {!isEdit && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {QUICK_SUGGESTIONS.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setTitle(sug)}
                    className="text-[11px] px-2 py-0.5 rounded-full border border-border/60 bg-muted/40 hover:bg-purple-500/10 hover:border-purple-500/30 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Data e Horário */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Data
              </label>
              <Input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className="h-10 text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Horário
              </label>
              <Input
                type="time"
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
                className="h-10 text-sm"
                required
              />
            </div>
          </div>

          {/* Duração */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">
              Duração estimada
            </label>
            <Select value={durationMinutes} onValueChange={setDurationMinutes}>
              <SelectTrigger className="h-10 text-sm">
                <SelectValue placeholder="Selecione a duração" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 minutos</SelectItem>
                <SelectItem value="60">1 hora</SelectItem>
                <SelectItem value="90">1 hora e 30 minutos</SelectItem>
                <SelectItem value="120">2 horas</SelectItem>
                <SelectItem value="180">3 horas</SelectItem>
                <SelectItem value="240">4 horas (meio período)</SelectItem>
                <SelectItem value="480">8 horas (dia todo)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Observações / Descrição */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">
              Observações / Detalhes (opcional)
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Endereço, lembretes ou informações adicionais..."
              className="min-h-[70px] text-sm resize-none"
            />
          </div>

          <DialogFooter className="pt-3 border-t border-border/40 flex items-center justify-between gap-2 sm:justify-between">
            {isEdit && onDelete && event ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive h-9"
                onClick={() => setConfirmDeleteOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Excluir
              </Button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-9 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving || !title.trim()}
                className="h-9 text-xs bg-purple-600 hover:bg-purple-700 text-white"
              >
                {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar evento'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* Modal interno de confirmação de exclusão */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir evento pessoal?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{event?.title || 'este evento'}"? Esta ação removerá o compromisso da sua agenda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={async () => {
                if (!event || !onDelete) return;
                setDeleting(true);
                try {
                  await onDelete(event.id);
                  setConfirmDeleteOpen(false);
                  onOpenChange(false);
                } finally {
                  setDeleting(false);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Excluindo...' : 'Excluir evento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
