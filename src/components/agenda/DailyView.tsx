import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TimeInput } from "@/components/ui/time-input";
import { useState, useEffect } from 'react';
import ConflictIndicator from './ConflictIndicator';
import { UnifiedEvent } from '@/hooks/useUnifiedCalendar';
import UnifiedEventCard from './UnifiedEventCard';
import { useAvailability } from '@/hooks/useAvailability';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
interface DailyViewProps {
  date: Date;
  unifiedEvents: UnifiedEvent[];
  onCreateSlot: (slot: { date: Date; time: string }) => void;
  onEventClick: (event: UnifiedEvent) => void;
}

const DEFAULT_TIME_SLOTS = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

export default function DailyView({
  date,
  unifiedEvents,
  onCreateSlot,
  onEventClick
}: DailyViewProps) {
  const [customTimeSlots, setCustomTimeSlots] = useState<{
    [key: string]: string[];
  }>({});
const [editingTimeSlot, setEditingTimeSlot] = useState<number | null>(null);
  const dateKey = format(date, 'yyyy-MM-dd');
  const { availability, deleteAvailabilitySlot } = useAvailability();

  // Load custom time slots from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('customTimeSlots');
    if (saved) {
      try {
        setCustomTimeSlots(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading custom time slots:', error);
      }
    }
  }, []);

  // Save custom time slots to localStorage
  useEffect(() => {
    localStorage.setItem('customTimeSlots', JSON.stringify(customTimeSlots));
  }, [customTimeSlots]);

  // Get time slots for the current date (include events and availability times)
  const getCurrentTimeSlots = () => {
    const baseSlots = customTimeSlots[dateKey] || DEFAULT_TIME_SLOTS;
    const eventTimes = unifiedEvents
      .filter(event => isSameDay(event.date, date))
      .map(event => event.time);
    const availabilityTimes = availability
      .filter(s => s.date === dateKey)
      .map(s => s.time);

    const merged = Array.from(new Set([...baseSlots, ...eventTimes, ...availabilityTimes])).sort();

    // If merged differs from stored, persist for this day
    if (merged.join('|') !== baseSlots.sort().join('|')) {
      setCustomTimeSlots(prev => ({
        ...prev,
        [dateKey]: merged
      }));
      return merged;
    }
    return baseSlots;
  };

  const timeSlots = getCurrentTimeSlots();
  const dayEvents = unifiedEvents.filter(event => isSameDay(event.date, date));

const getEventForSlot = (time: string) => {
    return dayEvents.find(event => event.time === time);
  };
  const hasAvailabilityForTime = (time: string) => {
    return availability.some(s => s.date === dateKey && s.time === time);
  };

  const handleRemoveAvailability = (time: string) => {
    const matches = availability.filter(s => s.date === dateKey && s.time === time);
    matches.forEach(s => deleteAvailabilitySlot(s.id));
    if (matches.length > 0) {
      toast.success('Disponibilidade removida');
    }
  };
  const handleEditTimeSlot = (index: number, currentTime: string) => {
    if (getEventForSlot(currentTime)) return;
    setEditingTimeSlot(index);
  };

  const handleSaveTimeSlot = (index: number, newTime: string) => {
    if (!newTime || !newTime.match(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
      setEditingTimeSlot(null);
      return;
    }

    const currentSlots = customTimeSlots[dateKey] || DEFAULT_TIME_SLOTS;
    if (currentSlots.includes(newTime) && currentSlots[index] !== newTime) {
      alert('Este horário já existe');
      setEditingTimeSlot(null);
      return;
    }

    const updatedSlots = [...currentSlots];
    updatedSlots[index] = newTime;
    updatedSlots.sort();
    setCustomTimeSlots(prev => ({
      ...prev,
      [dateKey]: updatedSlots
    }));
    setEditingTimeSlot(null);
  };

  return (
    <div className="bg-lunar-bg pb-16 md:pb-4">
      <div className="hidden md:flex justify-center mb-4">
        <h3 className="font-medium text-sm">
          {format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}
        </h3>
      </div>
      
      <div className="space-y-1">
        {timeSlots.map((time, index) => {
          const event = getEventForSlot(time);
          const isEditing = editingTimeSlot === index;
          
          return (
            <div 
              key={`${time}-${index}`} 
              className="flex border border-border rounded-md overflow-hidden py-0 my-[2px] mx-0 px-0"
            >
              <div className="p-3 w-16 flex-shrink-0 text-right text-sm text-muted-foreground relative bg-muted">
                {isEditing ? (
                  <TimeInput 
                    value={time} 
                    onChange={(newTime) => handleSaveTimeSlot(index, newTime)} 
                    onBlur={() => setEditingTimeSlot(null)} 
                  />
                ) : (
                  <span 
                    onClick={() => !event && handleEditTimeSlot(index, time)} 
                    className={`block text-xs ${!event ? 'cursor-pointer hover:bg-accent/30 rounded px-1 py-0.5' : ''}`} 
                    title={!event ? 'Clique para editar' : ''}
                  >
                    {time}
                  </span>
                )}
              </div>
              
              <div 
                onClick={() => !event && onCreateSlot({ date, time })} 
                className="flex-1 p-2 min-h-[50px] cursor-pointer bg-lunar-surface"
              >
                {event ? (
                  <div onClick={(e) => e.stopPropagation()}>
                    <UnifiedEventCard 
                      event={event} 
                      onClick={onEventClick}
                      variant="daily"
                    />
                  </div>
                 ) : (
                   <div className="flex items-center justify-between">
                     {hasAvailabilityForTime(time) ? (
                       <div className="inline-flex items-center gap-2">
                         <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-availability/20 border border-availability/50 text-lunar-text">
                           Disponível
                         </span>
                         <button
                           type="button"
                           onClick={(e) => { e.stopPropagation(); handleRemoveAvailability(time); }}
                           className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                           aria-label="Remover disponibilidade"
                           title="Remover disponibilidade"
                         >
                           <Trash2 className="h-3.5 w-3.5" /> Remover
                         </button>
                       </div>
                     ) : (
                       <span className="text-muted-foreground">Disponível</span>
                     )}
                     <ConflictIndicator date={date} time={time} />
                   </div>
                 )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
