import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { TimeInput } from '@/components/ui/time-input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { format, addDays } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { useAvailability } from '@/hooks/useAvailability';
import type { AvailabilitySlot, AvailabilityType } from '@/types/availability';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useAgenda } from '@/hooks/useAgenda';
import { Settings, Plus, Trash2 } from 'lucide-react';
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
  initialTime
}: AvailabilityConfigModalProps) {
  const {
    availability,
    availabilityTypes,
    addAvailabilitySlots,
    deleteAvailabilitySlot,
    clearAvailabilityForDate,
    addAvailabilityType,
    updateAvailabilityType,
    deleteAvailabilityType
  } = useAvailability();
  const [timesList, setTimesList] = useState<string[]>([]);
  const [clearExisting, setClearExisting] = useState<boolean>(true);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [showTypeManager, setShowTypeManager] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeColor, setNewTypeColor] = useState('#3b82f6');
  const weekDaysLabels = useMemo(() => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'], []);
  const allWeekdays = useMemo(() => [0, 1, 2, 3, 4, 5, 6], []);
  const allSelected = selectedWeekdays.length === 7;
  const toggleWeekday = (idx: number) => {
    setSelectedWeekdays(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
  };
  const handleSelectAllWeekdays = () => setSelectedWeekdays(allSelected ? [] : allWeekdays);
  useEffect(() => {
    setTimesList(initialTime ? [initialTime] : []);
    setStartDate(date);
    setEndDate(date);
    // Select first available type or default
    if (availabilityTypes.length > 0 && !selectedTypeId) {
      setSelectedTypeId(availabilityTypes[0].id);
    }
  }, [initialTime, isOpen, date, availabilityTypes, selectedTypeId]);
  const [startDate, setStartDate] = useState<Date>(date);
  const [endDate, setEndDate] = useState<Date>(date);
  const [manualTimesText, setManualTimesText] = useState<string>('');

  // Utilitários e manipuladores para lista de horários
  function isValidTime(t: string) {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(t);
  }
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  function normalizeTimes(list: string[]) {
    const valid = list.filter(isValidTime);
    const unique = Array.from(new Set(valid));
    unique.sort((a, b) => toMinutes(a) - toMinutes(b));
    return unique;
  }
  const addTimeRow = () => setTimesList(prev => [...prev, '']);
  const updateTimeAt = (idx: number, value: string) => setTimesList(prev => prev.map((t, i) => i === idx ? value : t));
  const removeTimeAt = (idx: number) => setTimesList(prev => prev.filter((_, i) => i !== idx));
  const dateStr = useMemo(() => format(date, 'yyyy-MM-dd'), [date]);
  const {
    appointments
  } = useAgenda();

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
        if (appointmentKeys.has(key)) {
          conflicts++;
          continue;
        }
        if (clearExisting) {
          availability.filter(a => a.date === ds && a.time === t).forEach(a => deleteAvailabilitySlot(a.id));
        }
        if (!existingAvailabilitySet.has(key) && !addedKeys.has(key)) {
          const selectedType = availabilityTypes.find(type => type.id === selectedTypeId);
          toAdd.push({
            id: '',
            date: ds,
            time: t,
            duration: 60,
            typeId: selectedTypeId,
            label: selectedType?.name,
            color: selectedType?.color
          });
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
        availability.filter(a => a.date === ds && a.time === t).forEach(a => {
          deleteAvailabilitySlot(a.id);
          removed++;
        });
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
    availability.filter(a => targetSet.has(a.date)).forEach(a => {
      deleteAvailabilitySlot(a.id);
      removed++;
    });
    toast.success(`Todas as disponibilidades no intervalo foram removidas: ${removed}.`);
    onClose();
  };
  const handleClearDay = () => {
    clearAvailabilityForDate(dateStr);
    onClose();
  };

  const handleAddType = () => {
    if (!newTypeName.trim()) {
      toast.error('Nome do tipo é obrigatório');
      return;
    }
    
    const newType: AvailabilityType = {
      id: crypto.randomUUID(),
      name: newTypeName.trim(),
      color: newTypeColor
    };
    
    addAvailabilityType(newType);
    setSelectedTypeId(newType.id);
    setNewTypeName('');
    setNewTypeColor('#3b82f6');
    setShowTypeManager(false);
    toast.success('Tipo de disponibilidade criado');
  };

  const handleDeleteType = (typeId: string) => {
    if (availabilityTypes.length <= 1) {
      toast.error('Não é possível excluir o último tipo');
      return;
    }
    
    deleteAvailabilityType(typeId);
    if (selectedTypeId === typeId) {
      const remainingTypes = availabilityTypes.filter(t => t.id !== typeId);
      setSelectedTypeId(remainingTypes[0]?.id || '');
    }
    toast.success('Tipo de disponibilidade excluído');
  };

  const selectedType = availabilityTypes.find(type => type.id === selectedTypeId);
  return <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-sm">Configurar disponibilidade</DialogTitle>
          <DialogDescription className="mb-4">
            Defina horários disponíveis para {format(date, "d 'de' MMMM, yyyy")}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="col-span-1 md:col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <Label>Tipo de disponibilidade</Label>
              <Popover open={showTypeManager} onOpenChange={setShowTypeManager}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 px-2">
                    <Settings className="h-4 w-4 mr-1" />
                    Gerenciar
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 bg-background border shadow-lg" align="end">
                  <div className="space-y-4 p-1">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Criar novo tipo</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Nome do tipo"
                          value={newTypeName}
                          onChange={(e) => setNewTypeName(e.target.value)}
                          className="flex-1"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={newTypeColor}
                            onChange={(e) => setNewTypeColor(e.target.value)}
                            className="w-8 h-8 rounded border cursor-pointer"
                          />
                          <Button onClick={handleAddType} size="sm">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Tipos existentes</Label>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {availabilityTypes.map(type => (
                          <div key={type.id} className="flex items-center justify-between p-2 bg-muted rounded">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full border"
                                style={{ backgroundColor: type.color }}
                              />
                              <span className="text-sm">{type.name}</span>
                            </div>
                            {availabilityTypes.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteType(type.id)}
                                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            
            <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Selecione um tipo">
                  {selectedType && (
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full border"
                        style={{ backgroundColor: selectedType.color }}
                      />
                      {selectedType.name}
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg">
                {availabilityTypes.map(type => (
                  <SelectItem key={type.id} value={type.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full border"
                        style={{ backgroundColor: type.color }}
                      />
                      {type.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data inicial</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("justify-start font-normal", !startDate && "text-muted-foreground")}> 
                  {format(startDate, 'dd/MM/yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={startDate} onSelect={d => d && setStartDate(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
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
                <Calendar mode="single" selected={endDate} onSelect={d => d && setEndDate(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>

          <div className="col-span-1 md:col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <Label>Dias da semana (opcional)</Label>
              <Button type="button" variant="outline" className="h-7 px-2 text-xs" onClick={handleSelectAllWeekdays}>
                {allSelected ? 'Limpar' : 'Todos'}
              </Button>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {weekDaysLabels.map((d, idx) => <label key={d} className="flex items-center gap-1.5 text-xs">
                  <Checkbox checked={selectedWeekdays.includes(idx)} onCheckedChange={() => toggleWeekday(idx)} />
                  <span>{d}</span>
                </label>)}
            </div>
            <p className="text-[11px] text-muted-foreground">Deixe em branco para aplicar em todos os dias do intervalo.</p>
          </div>

          <div className="col-span-1 md:col-span-2 space-y-2">
            <Label>Horários a liberar</Label>
            <div className="space-y-2">
              {timesList.length === 0 && <p className="text-xs text-muted-foreground">Nenhum horário adicionado ainda.</p>}
              {timesList.map((t, idx) => <div key={idx} className="flex items-center gap-2">
                  <div className="w-28">
                    <TimeInput value={t} onChange={v => updateTimeAt(idx, v)} />
                  </div>
                  <Button variant="ghost" onClick={() => removeTimeAt(idx)}>Remover</Button>
                </div>)}
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
          <Button variant="secondary" onClick={handleClearDay} className="text-xs text-chart-expense">Remover horários do dia</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>;
}