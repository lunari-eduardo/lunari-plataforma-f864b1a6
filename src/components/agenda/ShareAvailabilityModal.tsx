import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatDateForStorage } from '@/utils/dateUtils';
import { useAvailability } from '@/hooks/useAvailability';
import { Share2, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface ShareAvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  period: { start: Date; end: Date } | { day: Date };
  mode: 'day' | 'week';
}

export default function ShareAvailabilityModal({
  isOpen,
  onClose,
  period,
  mode
}: ShareAvailabilityModalProps) {
  const { availability, availabilityTypes } = useAvailability();
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>([]);

  // Get available types in the period
  const getAvailableTypes = () => {
    let dates: string[] = [];
    
    if ('day' in period) {
      dates = [formatDateForStorage(period.day)];
    } else {
      const current = new Date(period.start);
      const end = period.end.getTime();
      while (current.getTime() <= end) {
        dates.push(formatDateForStorage(current));
        current.setDate(current.getDate() + 1);
      }
    }

    const slotsInPeriod = availability.filter(slot => dates.includes(slot.date));
    const typeIds = Array.from(new Set(slotsInPeriod.map(slot => slot.typeId || 'default')));
    
    return typeIds
      .map(typeId => availabilityTypes.find(type => type.id === typeId))
      .filter(Boolean)
      .map(type => type!);
  };

  const availableTypes = getAvailableTypes();

  useEffect(() => {
    if (isOpen) {
      // Auto-select all types if only one, or none if multiple
      if (availableTypes.length === 1) {
        setSelectedTypeIds([availableTypes[0].id]);
      } else {
        setSelectedTypeIds([]);
      }
    }
  }, [isOpen, availableTypes.length]);

  const formatTimeBr = (time: string) => {
    const [hh, mm] = time.split(':');
    return mm === '00' ? `${hh}h` : `${hh}h ${mm}min`;
  };

  const generateShareText = () => {
    if (selectedTypeIds.length === 0) {
      return '';
    }

    const selectedTypes = availableTypes.filter(type => selectedTypeIds.includes(type.id));
    
    if (mode === 'day' && 'day' in period) {
      const dayStr = formatDateForStorage(period.day);
      const slots = availability
        .filter(slot => slot.date === dayStr && selectedTypeIds.includes(slot.typeId || 'default'))
        .map(slot => slot.time)
        .sort();

      if (slots.length === 0) return '';

      const dateStr = format(period.day, "dd 'de' MMMM", { locale: ptBR });
      const weekdayStr = format(period.day, 'eeee', { locale: ptBR });
      const times = slots.map(formatTimeBr).join('\n');
      
      const typeNames = selectedTypes.map(t => t.name).join(', ');
      const typePrefix = selectedTypes.length > 1 || selectedTypes[0].name !== 'Padrão' 
        ? ` (${typeNames})` 
        : '';

      return `No dia ${dateStr}, ${weekdayStr}, tenho os seguintes horários${typePrefix}:\n\n${times}\n\nQual fica melhor para você?`;
    } else if (mode === 'week') {
      const sections: string[] = [];
      const current = new Date('start' in period ? period.start : period.day);
      const end = ('end' in period ? period.end : period.day).getTime();

      while (current.getTime() <= end) {
        const dayStr = formatDateForStorage(current);
        const slots = availability
          .filter(slot => slot.date === dayStr && selectedTypeIds.includes(slot.typeId || 'default'))
          .map(slot => slot.time)
          .sort();

        if (slots.length > 0) {
          const dateStr = format(current, "dd 'de' MMMM", { locale: ptBR });
          const weekdayStr = format(current, 'eeee', { locale: ptBR });
          const times = slots.map(formatTimeBr).join('\n');
          sections.push(`No dia ${dateStr}, ${weekdayStr}, tenho os seguintes horários:\n\n${times}`);
        }
        
        current.setDate(current.getDate() + 1);
      }

      if (sections.length === 0) return '';

      const typeNames = selectedTypes.map(t => t.name).join(', ');
      const typeHeader = selectedTypes.length > 1 || selectedTypes[0].name !== 'Padrão'
        ? `Horários disponíveis (${typeNames}):\n\n`
        : 'Horários disponíveis:\n\n';

      return typeHeader + sections.join('\n\n') + '\n\nQual fica melhor para você?';
    }

    return '';
  };

  const handleShare = async () => {
    const text = generateShareText();
    if (!text) {
      toast.error('Nenhum horário selecionado para compartilhar.');
      return;
    }

    try {
      if (navigator.share) {
        await navigator.share({
          title: mode === 'day' ? 'Horários do dia' : 'Horários da semana',
          text
        });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success('Horários copiados para a área de transferência');
      }
      onClose();
    } catch (error) {
      try {
        await navigator.clipboard.writeText(text);
        toast.success('Horários copiados para a área de transferência');
        onClose();
      } catch {
        toast.error('Erro ao compartilhar horários');
      }
    }
  };

  const handleCopy = async () => {
    const text = generateShareText();
    if (!text) {
      toast.error('Nenhum horário selecionado para copiar.');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      toast.success('Horários copiados para a área de transferência');
    } catch {
      toast.error('Erro ao copiar horários');
    }
  };

  if (availableTypes.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Compartilhar Horários</DialogTitle>
            <DialogDescription>
              Não há horários disponíveis no período selecionado.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={onClose}>Fechar</Button>
        </DialogContent>
      </Dialog>
    );
  }

  // If only one type, share directly without showing modal
  if (availableTypes.length === 1 && isOpen) {
    setTimeout(() => {
      setSelectedTypeIds([availableTypes[0].id]);
    }, 0);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Compartilhar Horários
          </DialogTitle>
          <DialogDescription>
            Selecione os tipos de disponibilidade que deseja compartilhar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {availableTypes.length > 1 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Tipos de disponibilidade</Label>
              {availableTypes.map(type => (
                <div key={type.id} className="flex items-center space-x-3">
                  <Checkbox
                    id={type.id}
                    checked={selectedTypeIds.includes(type.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedTypeIds(prev => [...prev, type.id]);
                      } else {
                        setSelectedTypeIds(prev => prev.filter(id => id !== type.id));
                      }
                    }}
                  />
                  <Label htmlFor={type.id} className="flex items-center gap-2 cursor-pointer">
                    <div 
                      className="w-3 h-3 rounded-full border border-white/20"
                      style={{ backgroundColor: type.color }}
                    />
                    {type.name}
                  </Label>
                </div>
              ))}
            </div>
          )}

          {/* Preview */}
          {selectedTypeIds.length > 0 && (
            <div className="p-3 bg-muted rounded-lg">
              <Label className="text-xs font-medium text-muted-foreground">Preview:</Label>
              <div className="text-sm mt-1 whitespace-pre-line max-h-32 overflow-y-auto">
                {generateShareText()}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleCopy}
              disabled={selectedTypeIds.length === 0}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar
            </Button>
            <Button 
              onClick={handleShare}
              disabled={selectedTypeIds.length === 0}
            >
              <Share2 className="h-4 w-4 mr-2" />
              Compartilhar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}