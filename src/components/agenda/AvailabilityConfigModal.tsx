import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { TimeInput } from '@/components/ui/time-input';
import { format, startOfWeek, addDays } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { useAvailability } from '@/hooks/useAvailability';
import type { AvailabilitySlot } from '@/types/availability';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';

interface AvailabilityConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  initialTime?: string;
}

export default function AvailabilityConfigModal({ isOpen, onClose, date, initialTime }: AvailabilityConfigModalProps) {
  const { availability, addAvailabilitySlots, deleteAvailabilitySlot, clearAvailabilityForDate } = useAvailability();
  const [startTime, setStartTime] = useState<string>(initialTime || '09:00');
  const [endTime, setEndTime] = useState<string>('18:00');
  const [duration, setDuration] = useState<number | null>(60);
  const [clearExisting, setClearExisting] = useState<boolean>(true);
  const [endTouched, setEndTouched] = useState<boolean>(false);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const weekDaysLabels = useMemo(() => ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'], []);
  const toggleWeekday = (idx: number) => {
    setSelectedWeekdays(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
  };

  useEffect(() => {
    setStartTime(initialTime || '09:00');
    setEndTouched(false);
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

  const parseTimeToMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const minutesToTimeStr = (mins: number) => {
    const h = String(Math.floor(mins / 60)).padStart(2, '0');
    const m = String(mins % 60).padStart(2, '0');
    return `${h}:${m}`;
  };

  const snapEndToDuration = (start: string, end: string, minutes: number) => {
    const s = parseTimeToMinutes(start);
    let e = parseTimeToMinutes(end);
    if (e <= s) e = s + minutes;
    const diff = e - s;
    const remainder = diff % minutes;
    return minutesToTimeStr(e - remainder);
  };

  const recomputeDurationFromWindow = (start: string, end: string): number | null => {
    const s = parseTimeToMinutes(start);
    const e = parseTimeToMinutes(end);
    const total = e - s;
    if (total <= 0) return null;
    const allowed = [15, 30, 45, 60, 90];
    const match = allowed.find(d => total % d === 0);
    return match || null;
  };

  const computeTargetDates = (base: Date): Date[] => {
    if (selectedWeekdays.length === 0) return [base];
    const results: Date[] = [];
    const baseWeekStart = startOfWeek(base);
    for (let w = 0; w < 4; w++) {
      for (const wd of selectedWeekdays) {
        const d = addDays(baseWeekStart, wd + w * 7);
        if (d >= base) results.push(d);
      }
    }
    results.sort((a, b) => a.getTime() - b.getTime());
    return results;
  };

  useEffect(() => {
    if (duration && !endTouched) {
      setEndTime(prev => snapEndToDuration(startTime, prev, duration));
    }
  }, [duration, startTime, endTouched]);

  const handleEndTimeChange = (value: string) => {
    setEndTouched(true);
    setEndTime(value);
    const newDur = recomputeDurationFromWindow(startTime, value);
    if (newDur) {
      setDuration(newDur);
    } else {
      setDuration(null);
      toast.error('O término não alinha com uma duração suportada. Selecione uma duração.');
    }
  };

  const handleSave = () => {
    if (!startTime || !endTime || !duration || duration <= 0) {
      toast.error('Preencha início, término e duração válidos.');
      return;
    }
    const times = generateTimes(startTime, endTime, duration);
    const targetDates = computeTargetDates(date);

    const toAdd: AvailabilitySlot[] = [];
    const existingKeySet = new Set(availability.map(a => `${a.date}|${a.time}`));
    const addedKeys = new Set<string>();

    for (const d of targetDates) {
      const ds = format(d, 'yyyy-MM-dd');
      for (const t of times) {
        const key = `${ds}|${t}`;
        if (clearExisting) {
          // Remove apenas os slots existentes exatamente nestes horários
          availability
            .filter(a => a.date === ds && a.time === t)
            .forEach(a => deleteAvailabilitySlot(a.id));
          if (!addedKeys.has(key)) {
            toAdd.push({ id: '', date: ds, time: t, duration });
            addedKeys.add(key);
          }
        } else {
          if (!existingKeySet.has(key) && !addedKeys.has(key)) {
            toAdd.push({ id: '', date: ds, time: t, duration });
            addedKeys.add(key);
          }
        }
      }
    }

    if (toAdd.length === 0) {
      toast.error('Nenhum horário gerado. Verifique os campos.');
      return;
    }

    addAvailabilitySlots(toAdd);
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
            <TimeInput value={startTime} onChange={(v) => setStartTime(v)} />
          </div>
          <div className="space-y-2">
            <Label>Término</Label>
            <TimeInput value={endTime} onChange={(v) => handleEndTimeChange(v)} />
          </div>
          <div className="space-y-2">
            <Label>Duração (min)</Label>
            <Select value={duration ? String(duration) : undefined} onValueChange={(v) => setDuration(Number(v))}>
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
            <p className="text-[11px] text-muted-foreground">Se selecionar dias, aplicaremos nesses dias nas próximas 4 semanas.</p>
          </div>
          <div className="col-span-1 md:col-span-2 flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Substituir existentes</p>
              <p className="text-xs text-muted-foreground">Remove apenas os mesmos horários que já existirem nestes dias</p>
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
