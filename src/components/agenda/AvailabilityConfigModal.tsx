import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { TimeInput } from '@/components/ui/time-input';
import { format } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { useAvailability } from '@/hooks/useAvailability';
import type { RecurrenceType, AvailabilitySlot } from '@/types/availability';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';

interface AvailabilityConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  initialTime?: string;
}

export default function AvailabilityConfigModal({ isOpen, onClose, date, initialTime }: AvailabilityConfigModalProps) {
  const { addAvailabilitySlots, clearAvailabilityForDate } = useAvailability();
  const [startTime, setStartTime] = useState<string>(initialTime || '09:00');
  const [endTime, setEndTime] = useState<string>('18:00');
  const [duration, setDuration] = useState<number>(60);
  const [recurrence, setRecurrence] = useState<RecurrenceType>('none');
  const [clearExisting, setClearExisting] = useState<boolean>(true);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const weekDaysLabels = useMemo(() => ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'], []);
  const toggleWeekday = (idx: number) => {
    setSelectedWeekdays(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
  };

  useEffect(() => {
    setStartTime(initialTime || '09:00');
  }, [initialTime, isOpen]);

  const dateStr = useMemo(() => format(date, 'yyyy-MM-dd'), [date]);

  const generateTimes = (start: string, end: string, minutes: number): string[] => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const startTotal = sh * 60 + sm;
    const endTotal = eh * 60 + em;
    const times: string[] = [];
    for (let t = startTotal; t + minutes <= endTotal; t += minutes) {
      const h = Math.floor(t / 60).toString().padStart(2, '0');
      const m = (t % 60).toString().padStart(2, '0');
      times.push(`${h}:${m}`);
    }
    return times;
  };

  const calculateTargetDates = (base: Date): Date[] => {
    const dates: Date[] = [base];
    if (recurrence === 'next3days') {
      for (let i = 1; i <= 3; i++) {
        const d = new Date(base);
        d.setDate(d.getDate() + i);
        dates.push(d);
      }
    } else if (recurrence === 'weekly4') {
      for (let i = 1; i <= 3; i++) {
        const d = new Date(base);
        d.setDate(d.getDate() + i * 7);
        dates.push(d);
      }
    }
    return dates;
  };

  const handleSave = () => {
    if (!startTime || !endTime || duration <= 0) return;
    const times = generateTimes(startTime, endTime, duration);
    const baseDates = calculateTargetDates(date);
    const targetDates = selectedWeekdays.length
      ? baseDates.filter(d => selectedWeekdays.includes(d.getDay()))
      : baseDates;

    const allSlots: AvailabilitySlot[] = [];
    for (const d of targetDates) {
      const ds = format(d, 'yyyy-MM-dd');
      if (clearExisting) {
        clearAvailabilityForDate(ds);
      }
      for (const t of times) {
        allSlots.push({ id: '', date: ds, time: t, duration });
      }
    }

    if (allSlots.length === 0) {
      toast.error('Nenhum horário gerado. Verifique os campos.');
      return;
    }

    addAvailabilitySlots(allSlots);
    toast.success('Disponibilidades configuradas com sucesso');
    onClose();
  };

  const handleClearDay = () => {
    clearAvailabilityForDate(dateStr);
    toast.success('Disponibilidades do dia removidas');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Configurar disponibilidade</DialogTitle>
          <DialogDescription>
            Defina horários disponíveis para {format(date, "d 'de' MMMM, yyyy")}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Início</Label>
            <TimeInput value={startTime} onChange={setStartTime} />
          </div>
          <div className="space-y-2">
            <Label>Término</Label>
            <TimeInput value={endTime} onChange={setEndTime} />
          </div>
          <div className="space-y-2">
            <Label>Duração (min)</Label>
            <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15</SelectItem>
                <SelectItem value="30">30</SelectItem>
                <SelectItem value="45">45</SelectItem>
                <SelectItem value="60">60</SelectItem>
                <SelectItem value="90">90</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Recorrência</Label>
            <Select value={recurrence} onValueChange={(v) => setRecurrence(v as RecurrenceType)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Somente neste dia</SelectItem>
                <SelectItem value="next3days">Próximos 3 dias</SelectItem>
                <SelectItem value="weekly4">Semanal (4 semanas)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-1 md:col-span-2 space-y-2">
            <Label>Dias da semana (opcional)</Label>
            <div className="grid grid-cols-7 gap-2">
              {weekDaysLabels.map((d, idx) => (
                <label key={d} className="flex items-center gap-1.5 text-xs">
                  <Checkbox
                    checked={selectedWeekdays.includes(idx)}
                    onCheckedChange={() => toggleWeekday(idx)}
                  />
                  <span>{d}</span>
                </label>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">Se selecionar dias, aplicaremos apenas nesses dias dentro da recorrência escolhida.</p>
          </div>
          <div className="col-span-1 md:col-span-2 flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Substituir existentes</p>
              <p className="text-xs text-muted-foreground">Remove disponibilidades já criadas nestes dias</p>
            </div>
            <Switch checked={clearExisting} onCheckedChange={setClearExisting} />
          </div>
        </div>

        <div className="flex justify-between gap-2 pt-2">
          <Button variant="secondary" onClick={handleClearDay}>
            Remover do dia
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
