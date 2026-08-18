import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Video, Clock, Calendar, Trash2, Users, MapPin, UserCheck, Link as LinkIcon } from 'lucide-react';
import { formatDateForInput, safeParseInputDate } from '@/utils/dateUtils';
import ClientSearchCombobox from './ClientSearchCombobox';
import { useClientesRealtime } from '@/hooks/useClientesRealtime';
import type { Appointment } from '@/modules/agenda/presentation';

interface MeetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: Appointment | null;
  initialDate?: Date;
  initialTime?: string;
  onSave: (data: any) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
}

const MEETING_TYPE_SUGGESTIONS = [
  'Reunião de Alinhamento',
  'Apresentação de Fotos / Proposta',
  'Briefing de Ensaio',
  'Reunião com Noivos / Família',
  'Alinhamento com Parceiros / Fornecedores',
  'Visita Técnica / Locação',
];

export function MeetingModal({
  open,
  onOpenChange,
  event = null,
  initialDate,
  initialTime,
  onSave,
  onDelete,
}: MeetingModalProps) {
  const isEdit = !!event;
  const { clientes } = useClientesRealtime();

  const [title, setTitle] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [dateInput, setDateInput] = useState(() => formatDateForInput(initialDate || new Date()));
  const [timeInput, setTimeInput] = useState(initialTime || '14:00');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'confirmado' | 'a confirmar'>('confirmado');
  const [saving, setSaving] = useState(false);

  const selectedClient = useMemo(
    () => clientes.find((c) => c.id === clienteId),
    [clientes, clienteId]
  );

  useEffect(() => {
    if (!open) return;
    if (event) {
      setTitle(event.title || '');
      setClienteId(event.clienteId || '');
      setDateInput(formatDateForInput(event.date || new Date()));
      setTimeInput(event.time || '14:00');
      setDurationMinutes(String(event.durationMinutes || '60'));
      setLocation(event.location || '');
      setDescription(event.description || '');
      setStatus(event.status || 'confirmado');
    } else {
      setTitle('');
      setClienteId('');
      setDateInput(formatDateForInput(initialDate || new Date()));
      setTimeInput(initialTime || '14:00');
      setDurationMinutes('60');
      setLocation('');
      setDescription('');
      setStatus('confirmado');
    }
  }, [open, event, initialDate, initialTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    try {
      const parsedDate = safeParseInputDate(dateInput) || new Date();
      const clientName = selectedClient?.nome || title.trim();

      const payload: any = {
        title: title.trim(),
        client: clientName,
        clienteId: clienteId || undefined,
        date: parsedDate,
        time: timeInput || '14:00',
        type: 'reunião',
        agendaType: 'meeting',
        durationMinutes: parseInt(durationMinutes, 10) || 60,
        location: location.trim() || undefined,
        status,
        description: description.trim(),
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
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-cyan-500/15 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0">
              <Video className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                {isEdit ? 'Editar reunião' : 'Nova reunião'}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Reuniões com clientes, briefings ou parceiros
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Assunto / Título */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foreground">
              Assunto da reunião *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Reunião de Alinhamento, Briefing..."
              className="h-10 text-sm"
              autoFocus
              required
            />

            {/* Sugestões rápidas */}
            {!isEdit && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {MEETING_TYPE_SUGGESTIONS.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setTitle(sug)}
                    className="text-[11px] px-2 py-0.5 rounded-full border border-border/60 bg-muted/40 hover:bg-cyan-500/10 hover:border-cyan-500/30 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Vínculo com Cliente (CRM) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                Vincular cliente do CRM (opcional)
              </span>
              {clienteId && (
                <button
                  type="button"
                  onClick={() => setClienteId('')}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Desvincular
                </button>
              )}
            </label>
            <ClientSearchCombobox
              value={clienteId}
              onSelect={setClienteId}
              placeholder="Buscar cliente no CRM para a reunião..."
            />
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

          {/* Duração e Local / Link */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted-foreground">
                Duração estimada
              </label>
              <Select value={durationMinutes} onValueChange={setDurationMinutes}>
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder="Duração" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutos</SelectItem>
                  <SelectItem value="30">30 minutos</SelectItem>
                  <SelectItem value="45">45 minutos</SelectItem>
                  <SelectItem value="60">1 hora</SelectItem>
                  <SelectItem value="90">1 hora e 30 minutos</SelectItem>
                  <SelectItem value="120">2 horas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                Local ou Link (Meet/Zoom)
              </label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Google Meet, Estúdio, etc."
                className="h-10 text-sm"
              />
            </div>
          </div>

          {/* Pauta / Observações */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">
              Pauta da reunião / Observações (opcional)
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tópicos a discutir, link de acesso, referências..."
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
                onClick={async () => {
                  if (confirm('Deseja excluir esta reunião?')) {
                    await onDelete(event.id);
                    onOpenChange(false);
                  }
                }}
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
                className="h-9 text-xs bg-cyan-600 hover:bg-cyan-700 text-white"
              >
                {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Agendar reunião'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
