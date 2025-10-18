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
interface DailyViewProps {
  date: Date;
  unifiedEvents: UnifiedEvent[];
  onCreateSlot: (slot: {
    date: Date;
    time: string;
  }) => void;
  onEventClick: (event: UnifiedEvent) => void;
}
export default function DailyView({
  date,
  unifiedEvents,
  onCreateSlot,
  onEventClick
}: DailyViewProps) {
  const [editingTimeSlot, setEditingTimeSlot] = useState<number | null>(null);
  const dateKey = format(date, 'yyyy-MM-dd');
  
  const {
    availability,
    deleteAvailabilitySlot
  } = useAvailability();

  // Usar hook customizado para horários personalizados
  const {
    timeSlots: customSlots,
    isLoading: slotsLoading,
    hasCustomSlots,
    editTimeSlot,
    resetToDefault
  } = useCustomTimeSlots(date);

  // Get time slots for the current date (include events and availability times)
  const getCurrentTimeSlots = () => {
    const eventTimes = unifiedEvents
      .filter(event => isSameDay(event.date, date))
      .map(event => event.time);
    
    const availabilityTimes = availability
      .filter(s => s.date === dateKey)
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
    return availability.find(s => s.date === dateKey && s.time === time);
  };
  const handleRemoveAvailability = (time: string) => {
    const matches = availability.filter(s => s.date === dateKey && s.time === time);
    matches.forEach(s => deleteAvailabilitySlot(s.id));
    if (matches.length > 0) {
      toast.success('Disponibilidade removida');
    }
  };
  const handleEditTimeSlot = (index: number, currentTime: string) => {
    const events = getEventsForSlot(currentTime);
    if (events.length > 0) return;
    setEditingTimeSlot(index);
  };
  
  const handleSaveTimeSlot = async (index: number, newTime: string) => {
    const oldTime = timeSlots[index];
    const success = await editTimeSlot(oldTime, newTime);
    
    if (success) {
      setEditingTimeSlot(null);
    }
  };
  return <div className="bg-lunar-bg pb-16 md:pb-4">
      <div className="hidden md:flex justify-center mb-4">
        {hasCustomSlots && (
          <button 
            onClick={resetToDefault}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
            title="Restaurar horários padrão"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar horários padrão
          </button>
        )}
      </div>
      
      <div className="space-y-1">
        {timeSlots.map((time, index) => {
        const events = getEventsForSlot(time);
        const isEditing = editingTimeSlot === index;
        return <div key={`${time}-${index}`} className="flex border border-border rounded-md overflow-hidden py-0 my-[2px] mx-0 px-0">
              <div className="p-3 w-16 flex-shrink-0 text-right text-sm text-muted-foreground relative bg-muted">
                {isEditing ? <TimeInput value={time} onChange={newTime => handleSaveTimeSlot(index, newTime)} onBlur={() => setEditingTimeSlot(null)} /> : <span onClick={() => events.length === 0 && handleEditTimeSlot(index, time)} className={`block text-xs ${events.length === 0 ? 'cursor-pointer hover:bg-accent/30 rounded px-1 py-0.5' : ''}`} title={events.length === 0 ? 'Clique para editar' : ''}>
                    {time}
                    {events.length > 1 && <span className="block text-[10px] text-muted-foreground/70">
                        ({events.length})
                      </span>}
                  </span>}
              </div>
              
              <div onClick={() => events.length === 0 && onCreateSlot({
            date,
            time
          })} className="flex-1 p-2 min-h-[50px] cursor-pointer bg-lunar-surface">
                {events.length > 0 ? <div className="space-y-2">
                    {events.map((event, eventIndex) => <div key={event.id} className="flex items-center gap-2">
                        <div className="flex-1" onClick={e => e.stopPropagation()}>
                          <UnifiedEventCard event={event} onClick={onEventClick} variant="daily" />
                        </div>
                        {eventIndex === events.length - 1 && <button onClick={e => {
                  e.stopPropagation();
                  onCreateSlot({
                    date,
                    time
                  });
                }} className="flex-shrink-0 p-1.5 rounded-md bg-lunar-accent/10 hover:bg-lunar-accent/20 text-lunar-accent border border-lunar-accent/30 transition-colors" title="Adicionar outro agendamento no mesmo horário" aria-label="Adicionar agendamento">
                            <Plus className="h-4 w-4" />
                          </button>}
                      </div>)}
                  </div> : <div className="flex items-center justify-between">
                     {(() => {
                       const slot = getAvailabilityForTime(time);
                       return slot ? <div className="inline-flex items-center gap-2">
                          <span 
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-lunar-text border"
                            style={{ 
                              backgroundColor: slot.color ? `${slot.color}20` : 'hsl(var(--availability) / 0.2)',
                              borderColor: slot.color ? `${slot.color}80` : 'hsl(var(--availability) / 0.5)'
                            }}
                          >
                     {slot.label || 'Disponível'}
                           </span>
                          <button type="button" onClick={e => {
                  e.stopPropagation();
                  handleRemoveAvailability(time);
                }} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1" aria-label="Remover disponibilidade" title="Remover disponibilidade">
                           <Trash2 className="h-3.5 w-3.5" /> Remover
                          </button>
                        </div> : <span className="text-xs text-muted-foreground">Clique para criar agendamento</span>;
                     })()}
                     <ConflictIndicator date={date} time={time} />
                   </div>}
              </div>
            </div>;
      })}
      </div>
    </div>;
}