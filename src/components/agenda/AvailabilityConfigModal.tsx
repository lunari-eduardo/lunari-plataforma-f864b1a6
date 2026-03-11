import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { TimeInput } from '@/components/ui/time-input';
import { Checkbox } from '@/components/ui/checkbox';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useEffect, useMemo, useState } from 'react';
import { useAvailability } from '@/hooks/useAvailability';
import { useAgenda } from '@/hooks/useAgenda';
import type { AvailabilitySlot } from '@/types/availability';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Plus, X } from 'lucide-react';
import { formatDateForInput } from '@/utils/dateUtils';
import type { DateRange } from 'react-day-picker';

type Action = 'liberar' | 'bloquear';
type WeekdayMode = 'all' | 'specific';
type BlockMode = 'fullDay' | 'specific';
type LiberarMode = 'create' | 'replace';

interface AvailabilityConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  initialTime?: string;
}

export default function AvailabilityConfigModal({
  isOpen,
  onClose,
  date,
  initialTime,
}: AvailabilityConfigModalProps) {
  const {
    availability,
    availabilityTypes,
    addAvailabilitySlots,
    deleteAvailabilitySlot,
    clearAvailabilityForDate,
  } = useAvailability();
  const { appointments } = useAgenda();

  // === State ===
  const [action, setAction] = useState<Action>('liberar');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: date, to: date });
  const [weekdayMode, setWeekdayMode] = useState<WeekdayMode>('all');
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const [blockMode, setBlockMode] = useState<BlockMode>('fullDay');
  const [liberarMode, setLiberarMode] = useState<LiberarMode>('create');
  const [timeSlots, setTimeSlots] = useState<{ start: string; end?: string }[]>([]);
  const [fullDayDescription, setFullDayDescription] = useState('');

  const weekDaysLabels = useMemo(() => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'], []);

  // === Reset on open ===
  useEffect(() => {
    if (isOpen) {
      setAction('liberar');
      setDateRange({ from: date, to: date });
      setWeekdayMode('all');
      setSelectedWeekdays([]);
      setBlockMode('fullDay');
      setLiberarMode('create');
      setTimeSlots(initialTime ? [{ start: initialTime }] : []);
      setFullDayDescription('');
    }
  }, [isOpen, date, initialTime]);

  // === Helpers ===
  const toggleWeekday = (idx: number) => {
    setSelectedWeekdays(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const addTimeSlot = () => {
    setTimeSlots(prev => [...prev, { start: '', end: action === 'bloquear' ? '' : undefined }]);
  };

  const updateTimeSlot = (idx: number, field: 'start' | 'end', value: string) => {
    setTimeSlots(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  };

  const removeTimeSlot = (idx: number) => {
    setTimeSlots(prev => prev.filter((_, i) => i !== idx));
  };

  const isValidTime = (t: string) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(t);

  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const computeTargetDates = (): Date[] => {
    if (!dateRange?.from) return [];
    const start = dateRange.from;
    const end = dateRange.to || dateRange.from;
    const results: Date[] = [];
    let d = new Date(start);
    while (d <= end) {
      if (weekdayMode === 'all' || selectedWeekdays.includes(d.getDay())) {
        results.push(new Date(d));
      }
      d = addDays(d, 1);
    }
    return results;
  };

  // === Save ===
  const handleSave = async () => {
    const targetDates = computeTargetDates();
    if (targetDates.length === 0) {
      toast.error('Selecione ao menos um dia.');
      return;
    }

    const appointmentKeys = new Set(
      appointments.map(a => {
        const ds = typeof a.date === 'string' ? a.date : formatDateForInput(a.date);
        return `${ds}|${a.time}`;
      })
    );

    const tipo = availabilityTypes[0];
    const defaultLabel = tipo?.name || 'Disponível';
    const defaultColor = tipo?.color || '#10b981';

    try {
      if (action === 'bloquear') {
        await handleBloquear(targetDates, appointmentKeys);
      } else {
        await handleLiberar(targetDates, appointmentKeys, defaultLabel, defaultColor);
      }
      onClose();
    } catch (error) {
      console.error('❌ Erro ao salvar:', error);
      toast.error('Erro ao salvar. Tente novamente.');
    }
  };

  const handleBloquear = async (targetDates: Date[], appointmentKeys: Set<string>) => {
    const toAdd: AvailabilitySlot[] = [];

    for (const d of targetDates) {
      const ds = format(d, 'yyyy-MM-dd');

      if (blockMode === 'fullDay') {
        // Remove existing slots for this day
        availability.filter(a => a.date === ds).forEach(a => deleteAvailabilitySlot(a.id));
        
        toAdd.push({
          id: '',
          date: ds,
          time: '00:00',
          duration: 1440,
          label: 'Bloqueado',
          color: '#ef4444',
          isFullDay: true,
          fullDayDescription: fullDayDescription.trim() || 'Bloqueado',
        });
      } else {
        // Specific time blocks
        const validSlots = timeSlots.filter(s => isValidTime(s.start) && isValidTime(s.end || ''));
        if (validSlots.length === 0) {
          toast.error('Adicione ao menos um horário válido.');
          return;
        }

        for (const slot of validSlots) {
          const key = `${ds}|${slot.start}`;
          if (appointmentKeys.has(key)) continue;

          // Remove existing at this time
          availability.filter(a => a.date === ds && a.time === slot.start).forEach(a => deleteAvailabilitySlot(a.id));

          const duration = toMinutes(slot.end!) - toMinutes(slot.start);
          toAdd.push({
            id: '',
            date: ds,
            time: slot.start,
            duration: duration > 0 ? duration : 60,
            label: 'Bloqueado',
            color: '#ef4444',
          });
        }
      }
    }

    if (toAdd.length === 0) {
      toast.error('Nenhum horário gerado.');
      return;
    }

    await addAvailabilitySlots(toAdd);
    toast.success(`${blockMode === 'fullDay' ? 'Dias' : 'Horários'} bloqueados: ${toAdd.length}`);
  };

  const handleLiberar = async (
    targetDates: Date[],
    appointmentKeys: Set<string>,
    label: string,
    color: string
  ) => {
    const validTimes = timeSlots.map(s => s.start).filter(isValidTime);
    if (validTimes.length === 0) {
      toast.error('Adicione ao menos um horário válido.');
      return;
    }

    const uniqueTimes = Array.from(new Set(validTimes)).sort((a, b) => toMinutes(a) - toMinutes(b));
    const existingSet = new Set(availability.map(a => `${a.date}|${a.time}`));
    const toAdd: AvailabilitySlot[] = [];
    let conflicts = 0;

    for (const d of targetDates) {
      const ds = format(d, 'yyyy-MM-dd');

      if (liberarMode === 'replace') {
        // Remove existing availability for these times
        for (const t of uniqueTimes) {
          availability.filter(a => a.date === ds && a.time === t).forEach(a => deleteAvailabilitySlot(a.id));
        }
      }

      for (const t of uniqueTimes) {
        const key = `${ds}|${t}`;
        if (appointmentKeys.has(key)) {
          conflicts++;
          continue;
        }

        if (liberarMode === 'create' && existingSet.has(key)) continue;

        toAdd.push({
          id: '',
          date: ds,
          time: t,
          duration: 60,
          label,
          color,
        });
      }
    }

    if (toAdd.length === 0) {
      toast.error('Nenhum horário gerado. Verifique conflitos.');
      return;
    }

    await addAvailabilitySlots(toAdd);
    toast.success(`Horários liberados: ${toAdd.length}${conflicts > 0 ? ` (${conflicts} conflitos ignorados)` : ''}`);
  };

  // === Remove all in range ===
  const handleRemoveInRange = () => {
    const targetDates = computeTargetDates();
    if (targetDates.length === 0) {
      toast.error('Selecione ao menos um dia.');
      return;
    }
    const targetSet = new Set(targetDates.map(d => format(d, 'yyyy-MM-dd')));
    let removed = 0;
    availability.filter(a => targetSet.has(a.date)).forEach(a => {
      deleteAvailabilitySlot(a.id);
      removed++;
    });
    toast.success(`Disponibilidades removidas: ${removed}`);
    onClose();
  };

  // === Render ===
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Configurar disponibilidade</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* === Seção 1: Ação === */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">O que deseja fazer?</Label>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-white/30 dark:bg-white/[0.05] p-1">
              <button
                type="button"
                onClick={() => setAction('liberar')}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-all',
                  action === 'liberar'
                    ? 'bg-white/70 dark:bg-white/[0.1] text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Liberar horários
              </button>
              <button
                type="button"
                onClick={() => setAction('bloquear')}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-all',
                  action === 'bloquear'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Bloquear horários
              </button>
            </div>
          </div>

          {/* === Seção 2: Período === */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Período</Label>
            <div className="flex justify-center">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                locale={ptBR}
                className="rounded-md border"
              />
            </div>

            <div className="space-y-2 pt-1">
              <p className="text-xs text-muted-foreground">Aplicar para:</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="weekdayMode"
                    checked={weekdayMode === 'all'}
                    onChange={() => setWeekdayMode('all')}
                    className="accent-primary"
                  />
                  <span className="text-sm">Todos os dias do período</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="weekdayMode"
                    checked={weekdayMode === 'specific'}
                    onChange={() => setWeekdayMode('specific')}
                    className="accent-primary"
                  />
                  <span className="text-sm">Dias específicos da semana</span>
                </label>
              </div>

              {weekdayMode === 'specific' && (
                <div className="flex gap-2 pt-1 flex-wrap">
                  {weekDaysLabels.map((label, idx) => (
                    <label key={label} className="flex items-center gap-1 text-xs cursor-pointer">
                      <Checkbox
                        checked={selectedWeekdays.includes(idx)}
                        onCheckedChange={() => toggleWeekday(idx)}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* === Seção 3: Aplicação === */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Aplicação</Label>

            {action === 'bloquear' ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="blockMode"
                      checked={blockMode === 'fullDay'}
                      onChange={() => setBlockMode('fullDay')}
                      className="accent-primary"
                    />
                    <span className="text-sm">Dia inteiro</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="blockMode"
                      checked={blockMode === 'specific'}
                      onChange={() => setBlockMode('specific')}
                      className="accent-primary"
                    />
                    <span className="text-sm">Horários específicos</span>
                  </label>
                </div>

                {blockMode === 'fullDay' && (
                  <Textarea
                    value={fullDayDescription}
                    onChange={e => setFullDayDescription(e.target.value)}
                    placeholder="Motivo (ex: Férias, Feriado...)"
                    className="resize-none text-sm"
                    rows={2}
                  />
                )}

                {blockMode === 'specific' && (
                  <div className="space-y-2">
                    {timeSlots.map((slot, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="w-20">
                          <TimeInput
                            value={slot.start}
                            onChange={v => updateTimeSlot(idx, 'start', v)}
                            placeholder="Início"
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">–</span>
                        <div className="w-20">
                          <TimeInput
                            value={slot.end || ''}
                            onChange={v => updateTimeSlot(idx, 'end', v)}
                            placeholder="Fim"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeTimeSlot(idx)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" onClick={addTimeSlot} className="text-xs gap-1">
                      <Plus className="h-3 w-3" />
                      Adicionar horário
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="liberarMode"
                      checked={liberarMode === 'create'}
                      onChange={() => setLiberarMode('create')}
                      className="accent-primary"
                    />
                    <div>
                      <span className="text-sm">Criar novos horários</span>
                      <p className="text-xs text-muted-foreground">Adiciona onde não houver</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="liberarMode"
                      checked={liberarMode === 'replace'}
                      onChange={() => setLiberarMode('replace')}
                      className="accent-primary"
                    />
                    <div>
                      <span className="text-sm">Substituir existentes</span>
                      <p className="text-xs text-muted-foreground">Recria os horários no período</p>
                    </div>
                  </label>
                </div>

                <div className="space-y-2">
                  {timeSlots.map((slot, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="w-24">
                        <TimeInput
                          value={slot.start}
                          onChange={v => updateTimeSlot(idx, 'start', v)}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeTimeSlot(idx)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" onClick={addTimeSlot} className="text-xs gap-1">
                    <Plus className="h-3 w-3" />
                    Adicionar horário
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* === Footer === */}
        <div className="flex items-center justify-between pt-4">
          <button
            type="button"
            onClick={handleRemoveInRange}
            className="text-xs text-destructive hover:underline"
          >
            Remover deste período
          </button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave}>
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
