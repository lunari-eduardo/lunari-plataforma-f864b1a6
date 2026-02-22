import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TimeInput } from "@/components/ui/time-input";
import { useState } from 'react';
import ConflictIndicator from './ConflictIndicator';
import { Plus, Trash2, RotateCcw } from 'lucide-react';
import { UnifiedEvent } from '@/hooks/useUnifiedCalendar';
import UnifiedEventCard from './UnifiedEventCard';
import { useAvailability } from '@/hooks/useAvailability';
import { useCustomTimeSlots } from '@/hooks/useCustomTimeSlots';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import TimeSlotOptionsMenu from './TimeSlotOptionsMenu';
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

interface DailyViewProps {
  date: Date;
  unifiedEvents: UnifiedEvent[];
  onCreateSlot: (slot: {
    date: Date;
    time: string;
  }) => void;
  onEventClick: (event: UnifiedEvent) => void;
  onOpenAvailability?: (date: Date, time: string) => void;
}

export default function DailyView({
  date,
  unifiedEvents,
  onCreateSlot,
  onEventClick,
  onOpenAvailability
}: DailyViewProps) {
  const [editingTimeSlot, setEditingTimeSlot] = useState<number | null>(null);
  const [isSavingTimeSlot, setIsSavingTimeSlot] = useState(false);
  const [showAddTimeSlot, setShowAddTimeSlot] = useState(false);
  const [newTimeInput, setNewTimeInput] = useState('');
  const [unlockConfirmTime, setUnlockConfirmTime] = useState<string | null>(null);
  const dateKey = format(date, 'yyyy-MM-dd');
  
  const {
    availability,
    addAvailabilitySlots,
    deleteAvailabilitySlot
  } = useAvailability();

  // Usar hook customizado para horários personalizados
  const {
    timeSlots: customSlots,
    isLoading: slotsLoading,
    hasCustomSlots,
    addTimeSlot,
    editTimeSlot,
    removeTimeSlot,
    resetToDefault
  } = useCustomTimeSlots(date);

  // Verificar se existe slot de "dia todo" para a data atual
  const fullDaySlot = availability.find(
    s => s.date === dateKey && s.isFullDay
  );

  // Get time slots for the current date (include events and availability times)
  const getCurrentTimeSlots = () => {
    const eventTimes = unifiedEvents
      .filter(event => isSameDay(event.date, date))
      .map(event => event.time);
    
    // Não incluir slot de dia todo nos horários
    const availabilityTimes = availability
      .filter(s => s.date === dateKey && !s.isFullDay)
      .map(s => s.time);
    
    const merged = Array.from(new Set([
      ...customSlots,
      ...eventTimes,
      ...availabilityTimes
    ])).sort();
    
    return merged;
  };
  
  const timeSlots = getCurrentTimeSlots();
  const dayEvents = unifiedEvents.filter(event => isSameDay(event.date, date));
  
  const getEventsForSlot = (time: string) => {
    return dayEvents.filter(event => event.time === time);
  };
  
  const getAvailabilityForTime = (time: string) => {
    return availability.find(s => s.date === dateKey && s.time === time && !s.isFullDay);
  };

  const isBlockedSlot = (time: string) => {
    const slot = getAvailabilityForTime(time);
    return slot?.label === 'Bloqueado';
  };
  
  const handleRemoveAvailability = (time: string) => {
    const matches = availability.filter(s => s.date === dateKey && s.time === time);
    matches.forEach(s => deleteAvailabilitySlot(s.id));
    if (matches.length > 0) {
      toast.success('Disponibilidade removida');
    }
  };

  const handleBlockSlot = async (time: string) => {
    // Remove existing availability for this time first
    const existing = availability.filter(s => s.date === dateKey && s.time === time && !s.isFullDay);
    existing.forEach(s => deleteAvailabilitySlot(s.id));
    
    await addAvailabilitySlots([{
      date: dateKey,
      time,
      duration: 60,
      label: 'Bloqueado',
      color: '#ef4444',
    }]);
    toast.success('Horário bloqueado');
  };

  const handleUnblockSlot = (time: string) => {
    const matches = availability.filter(s => s.date === dateKey && s.time === time && s.label === 'Bloqueado');
    matches.forEach(s => deleteAvailabilitySlot(s.id));
    toast.success('Horário desbloqueado');
    setUnlockConfirmTime(null);
  };

  const handleRemoveTimeSlot = async (time: string) => {
    // Also remove any availability for this time
    const existing = availability.filter(s => s.date === dateKey && s.time === time && !s.isFullDay);
    existing.forEach(s => deleteAvailabilitySlot(s.id));
    await removeTimeSlot(time);
  };
  
  const handleEditTimeSlot = (index: number, currentTime: string) => {
    const events = getEventsForSlot(currentTime);
    if (events.length > 0) return;
    setEditingTimeSlot(index);
  };
  
  const handleSaveTimeSlot = async (index: number, newTime: string) => {
    setIsSavingTimeSlot(true);
    const oldTime = timeSlots[index];
    const success = await editTimeSlot(oldTime, newTime);
    
    if (success) {
      setEditingTimeSlot(null);
    }
    
    // Delay de segurança para garantir que o estado atualize antes de permitir cliques
    setTimeout(() => {
      setIsSavingTimeSlot(false);
    }, 150);
  };

  const handleAddNewTimeSlot = async () => {
    if (!newTimeInput.trim()) {
      toast.error('Digite um horário válido');
      return;
    }
    const success = await addTimeSlot(newTimeInput);
    if (success) {
      setShowAddTimeSlot(false);
      setNewTimeInput('');
    }
  };

  const handleRemoveFullDay = () => {
    if (fullDaySlot) {
      deleteAvailabilitySlot(fullDaySlot.id);
      toast.success('Dia todo removido');
    }
  };
  return (
    <div className="bg-lunar-bg pb-16 md:pb-4">
      {/* Header com botão de adicionar horário */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Popover open={showAddTimeSlot} onOpenChange={setShowAddTimeSlot}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="h-7 w-7 rounded-full">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="start">
              <div className="flex items-center gap-2">
                <div className="w-24">
                  <TimeInput 
                    value={newTimeInput} 
                    onChange={setNewTimeInput}
                    placeholder="HH:mm"
                  />
                </div>
                <Button size="sm" onClick={handleAddNewTimeSlot}>
                  Adicionar
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        
        {hasCustomSlots && (
          <button 
            onClick={resetToDefault}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
            title="Restaurar horários padrão"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Restaurar padrão</span>
          </button>
        )}
      </div>

      {/* Banner de Dia Todo */}
      {fullDaySlot && (
        <div 
          className="p-4 rounded-lg mb-4 border-2"
          style={{ 
            backgroundColor: fullDaySlot.color ? `${fullDaySlot.color}20` : 'hsl(var(--muted))',
            borderColor: fullDaySlot.color || 'hsl(var(--border))'
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                {fullDaySlot.color && (
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: fullDaySlot.color }}
                  />
                )}
                <span className="font-medium">{fullDaySlot.label || 'Dia todo ocupado'}</span>
              </div>
              {fullDaySlot.fullDayDescription && (
                <p className="text-sm text-muted-foreground mt-1">
                  {fullDaySlot.fullDayDescription}
                </p>
              )}
            </div>
            <button 
              onClick={handleRemoveFullDay}
              className="text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1 transition-colors ml-4"
              title="Remover dia todo"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
      
      <div className="space-y-1">
        {timeSlots.map((time, index) => {
          const events = getEventsForSlot(time);
          const isEditing = editingTimeSlot === index;
          
          const blocked = isBlockedSlot(time);
          
          // Se tem dia todo, aplicar cor de fundo do tipo
          const slotBgStyle = fullDaySlot ? {
            backgroundColor: fullDaySlot.color ? `${fullDaySlot.color}10` : undefined
          } : blocked ? {
            backgroundColor: 'hsl(var(--destructive) / 0.08)'
          } : {};
          
          return (
            <div 
              key={`${time}-${index}`} 
              className={`flex border rounded-md overflow-hidden py-0 my-[2px] mx-0 px-0 ${blocked ? 'border-destructive/30' : 'border-border'}`}
              style={slotBgStyle}
            >
              <div className="p-3 w-16 flex-shrink-0 text-right text-sm text-muted-foreground relative bg-muted">
                {isEditing ? (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <TimeInput 
                      value={time} 
                      onChange={newTime => handleSaveTimeSlot(index, newTime)} 
                      onBlur={() => setEditingTimeSlot(null)} 
                    />
                  </div>
                ) : (
                  <span 
                    onClick={() => events.length === 0 && !blocked && handleEditTimeSlot(index, time)} 
                    className={`block text-xs ${events.length === 0 && !blocked ? 'cursor-pointer hover:bg-accent/30 rounded px-1 py-0.5' : ''}`} 
                    title={events.length === 0 && !blocked ? 'Clique para editar' : ''}
                  >
                    {time}
                    {events.length > 1 && (
                      <span className="block text-[10px] text-muted-foreground/70">
                        ({events.length})
                      </span>
                    )}
                  </span>
                )}
              </div>
              
              <div 
                onClick={() => {
                  if (isEditing || isSavingTimeSlot) return;
                  if (blocked) {
                    setUnlockConfirmTime(time);
                    return;
                  }
                  if (events.length === 0) {
                    onCreateSlot({ date, time });
                  }
                }} 
                className={`flex-1 p-2 min-h-[50px] cursor-pointer ${blocked ? 'bg-destructive/5' : 'bg-lunar-surface'}`}
              >
                {events.length > 0 ? (
                  <div className="space-y-2">
                    {events.map((event, eventIndex) => (
                      <div key={event.id} className="flex items-center gap-2">
                        <div className="flex-1" onClick={e => e.stopPropagation()}>
                          <UnifiedEventCard event={event} onClick={onEventClick} variant="daily" />
                        </div>
                        {eventIndex === events.length - 1 && (
                          <button 
                            onClick={e => {
                              e.stopPropagation();
                              onCreateSlot({ date, time });
                            }} 
                            className="flex-shrink-0 p-1.5 rounded-md bg-lunar-accent/10 hover:bg-lunar-accent/20 text-lunar-accent border border-lunar-accent/30 transition-colors" 
                            title="Adicionar outro agendamento no mesmo horário" 
                            aria-label="Adicionar agendamento"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : blocked ? (
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-destructive/15 text-destructive border border-destructive/30">
                      Bloqueado
                    </span>
                    <div onClick={e => e.stopPropagation()}>
                      <TimeSlotOptionsMenu
                        onAvailable={() => {
                          handleRemoveAvailability(time);
                          if (onOpenAvailability) onOpenAvailability(date, time);
                        }}
                        onBlock={() => {}} 
                        onRemove={() => handleRemoveTimeSlot(time)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    {(() => {
                      const slot = getAvailabilityForTime(time);
                      return slot ? (
                        <div className="inline-flex items-center gap-2">
                          <span 
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-lunar-text border"
                            style={{ 
                              backgroundColor: slot.color ? `${slot.color}20` : 'hsl(var(--availability) / 0.2)',
                              borderColor: slot.color ? `${slot.color}80` : 'hsl(var(--availability) / 0.5)'
                            }}
                          >
                            {slot.label || 'Disponível'}
                          </span>
                          <button 
                            type="button" 
                            onClick={e => {
                              e.stopPropagation();
                              handleRemoveAvailability(time);
                            }} 
                            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1" 
                            aria-label="Remover disponibilidade" 
                            title="Remover disponibilidade"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remover
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Clique para criar agendamento</span>
                      );
                    })()}
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <ConflictIndicator date={date} time={time} />
                      <TimeSlotOptionsMenu
                        onAvailable={() => {
                          if (onOpenAvailability) onOpenAvailability(date, time);
                        }}
                        onBlock={() => handleBlockSlot(time)}
                        onRemove={() => handleRemoveTimeSlot(time)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* AlertDialog para confirmar desbloqueio */}
      <AlertDialog open={!!unlockConfirmTime} onOpenChange={(open) => !open && setUnlockConfirmTime(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desbloquear horário?</AlertDialogTitle>
            <AlertDialogDescription>
              O horário {unlockConfirmTime} está bloqueado. Deseja liberar este horário para agendamentos?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => unlockConfirmTime && handleUnblockSlot(unlockConfirmTime)}>
              Desbloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}