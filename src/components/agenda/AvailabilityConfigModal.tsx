import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';


import { Switch } from '@/components/ui/switch';
import { TimeInput } from '@/components/ui/time-input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { format, addDays } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { useAvailability } from '@/hooks/useAvailability';
import type { AvailabilitySlot } from '@/types/availability';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

import { useAgenda } from '@/hooks/useAgenda';

interface AvailabilityConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  initialTime?: string;
}

export default function AvailabilityConfigModal({ isOpen, onClose, date, initialTime }: AvailabilityConfigModalProps) {
  const { availability, addAvailabilitySlots, deleteAvailabilitySlot, clearAvailabilityForDate } = useAvailability();
  const [timesList, setTimesList] = useState<string[]>([]);
  const [clearExisting, setClearExisting] = useState<boolean>(true);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const weekDaysLabels = useMemo(() => ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'], []);
  const toggleWeekday = (idx: number) => {
    setSelectedWeekdays(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
  };

  useEffect(() => {
    setTimesList(initialTime ? [initialTime] : []);
    setStartDate(date);
    setEndDate(date);
  }, [initialTime, isOpen, date]);


const [startDate, setStartDate] = useState<Date>(date);
const [endDate, setEndDate] = useState<Date>(date);
const [manualTimesText, setManualTimesText] = useState<string>('');

// Utilitários e manipuladores para lista de horários
function isValidTime(t: string) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(t);
}
const toMinutes = (t: string) => { const [h,m] = t.split(":").map(Number); return h*60+m; };
function normalizeTimes(list: string[]) {
  const valid = list.filter(isValidTime);
  const unique = Array.from(new Set(valid));
  unique.sort((a,b)=>toMinutes(a)-toMinutes(b));
  return unique;
}
const addTimeRow = () => setTimesList(prev => [...prev, '']);
const updateTimeAt = (idx: number, value: string) => setTimesList(prev => prev.map((t,i) => i===idx ? value : t));
const removeTimeAt = (idx: number) => setTimesList(prev => prev.filter((_,i) => i!==idx));

  const dateStr = useMemo(() => format(date, 'yyyy-MM-dd'), [date]);
  const { appointments } = useAgenda();

  // Calcula as datas alvo entre início e fim, aplicando dias da semana quando selecionados
  const computeTargetDatesBetween = (start: Date, end: Date, weekdays: number[]): Date[] => {
    const results: Date[] = [];
    let d = new Date(start);
    while (d <= end) {
      if (weekdays.length === 0 || weekdays.includes(d.getDay())) {
        results.push(new Date(d));
      }
      d = addDays(d, 1);
    }
    return results;
  };

  // Sem sincronização automática de término/duração: usando lista manual de horários

  const handleSave = () => {
    const times = normalizeTimes(timesList);
    if (times.length === 0) {
      toast.error('Adicione pelo menos um horário válido (HH:mm).');
      return;
    }
    if (startDate > endDate) {
      toast.error('Data inicial não pode ser maior que a final.');
      return;
    }

    const targetDates = computeTargetDatesBetween(startDate, endDate, selectedWeekdays);
    const appointmentKeys = new Set(appointments.map(a => `${format(a.date, 'yyyy-MM-dd')}|${a.time}`));
    const existingAvailabilitySet = new Set(availability.map(a => `${a.date}|${a.time}`));
    const addedKeys = new Set<string>();

    const toAdd: AvailabilitySlot[] = [];
    let conflicts = 0;
    let duplicates = 0;

    for (const d of targetDates) {
      const ds = format(d, 'yyyy-MM-dd');
      for (const t of times) {
        const key = `${ds}|${t}`;
        if (appointmentKeys.has(key)) { conflicts++; continue; }

        if (clearExisting) {
          availability
            .filter(a => a.date === ds && a.time === t)
            .forEach(a => deleteAvailabilitySlot(a.id));
        }

        if (!existingAvailabilitySet.has(key) && !addedKeys.has(key)) {
          toAdd.push({ id: '', date: ds, time: t, duration: 60 });
          addedKeys.add(key);
        } else {
          duplicates++;
        }
      }
    }

    if (toAdd.length === 0) {
      toast.error('Nenhum horário gerado. Verifique os campos.');
      return;
    }

    addAvailabilitySlots(toAdd);
    toast.success(`Disponibilidades adicionadas: ${toAdd.length}. Conflitos com agendamentos: ${conflicts}. Duplicados: ${duplicates}.`);
    onClose();
  };

  const handleRemoveTimesInRange = () => {
    const times = normalizeTimes(timesList);
    if (times.length === 0) {
      toast.error('Informe ao menos um horário para remover.');
      return;
    }
    if (startDate > endDate) {
      toast.error('Data inicial não pode ser maior que a final.');
      return;
    }
    const targetDates = computeTargetDatesBetween(startDate, endDate, selectedWeekdays);
    let removed = 0;
    for (const d of targetDates) {
      const ds = format(d, 'yyyy-MM-dd');
      for (const t of times) {
        availability
          .filter(a => a.date === ds && a.time === t)
          .forEach(a => { deleteAvailabilitySlot(a.id); removed++; });
      }
    }
    toast.success(`Disponibilidades removidas: ${removed}.`);
    onClose();
  };

  const handleRemoveAllInRange = () => {
    if (startDate > endDate) {
      toast.error('Data inicial não pode ser maior que a final.');
      return;
    }
    const targetDates = computeTargetDatesBetween(startDate, endDate, selectedWeekdays);
    const targetSet = new Set(targetDates.map(d => format(d, 'yyyy-MM-dd')));
    let removed = 0;
    availability
      .filter(a => targetSet.has(a.date))
      .forEach(a => { deleteAvailabilitySlot(a.id); removed++; });
    toast.success(`Todas as disponibilidades no intervalo foram removidas: ${removed}.`);
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
            <Label>Data inicial</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("justify-start font-normal", !startDate && "text-muted-foreground")}> 
                  {format(startDate, 'dd/MM/yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar 
                  mode="single" 
                  selected={startDate}
                  onSelect={(d) => d && setStartDate(d)}
                  initialFocus 
                  className={cn("p-3 pointer-events-auto")} 
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label>Data final</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("justify-start font-normal", !endDate && "text-muted-foreground")}> 
                  {format(endDate, 'dd/MM/yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar 
                  mode="single" 
                  selected={endDate}
                  onSelect={(d) => d && setEndDate(d)}
                  initialFocus 
                  className={cn("p-3 pointer-events-auto")} 
                />
              </PopoverContent>
            </Popover>
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
            <p className="text-[11px] text-muted-foreground">Deixe em branco para aplicar em todos os dias do intervalo.</p>
          </div>

          <div className="col-span-1 md:col-span-2 space-y-2">
            <Label>Horários a liberar</Label>
            <div className="space-y-2">
              {timesList.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum horário adicionado ainda.</p>
              )}
              {timesList.map((t, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-28">
                    <TimeInput value={t} onChange={(v) => updateTimeAt(idx, v)} />
                  </div>
                  <Button variant="ghost" onClick={() => removeTimeAt(idx)}>Remover</Button>
                </div>
              ))}
              <Button variant="secondary" onClick={addTimeRow}>+ Adicionar horário</Button>
              <p className="text-[11px] text-muted-foreground">Os horários serão criados apenas onde não houver agendamento.</p>
            </div>
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
