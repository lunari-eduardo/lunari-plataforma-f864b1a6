import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Calendar, Download, FileText, List, AlertCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { DadosExportacaoExtrato } from '@/types/extrato';

interface PeriodSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (params: {
    startDate: string;
    endDate: string;
    format: 'csv' | 'pdf';
  }) => Promise<void>;
  dadosExtrato: DadosExportacaoExtrato;
  title: string;
  description?: string;
}

export default function PeriodSelectionModal({
  isOpen,
  onClose,
  onExport,
  dadosExtrato,
  title,
  description
}: PeriodSelectionModalProps) {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [isExporting, setIsExporting] = useState(false);

  // Quick period options
  const quickOptions = [
    {
      label: 'Mês atual',
      getValue: () => {
        const hoje = new Date();
        const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        return { inicio, fim };
      }
    },
    {
      label: 'Mês anterior',
      getValue: () => {
        const hoje = new Date();
        const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
        const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
        return { inicio, fim };
      }
    },
    {
      label: 'Trimestre atual',
      getValue: () => {
        const hoje = new Date();
        const trimestre = Math.floor(hoje.getMonth() / 3);
        const inicio = new Date(hoje.getFullYear(), trimestre * 3, 1);
        const fim = new Date(hoje.getFullYear(), trimestre * 3 + 3, 0);
        return { inicio, fim };
      }
    },
    {
      label: 'Ano atual',
      getValue: () => {
        const hoje = new Date();
        const inicio = new Date(hoje.getFullYear(), 0, 1);
        const fim = new Date(hoje.getFullYear(), 11, 31);
        return { inicio, fim };
      }
    }
  ];

  // Calculate filtered transactions count
  const filteredCount = useMemo(() => {
    if (!startDate || !endDate) return dadosExtrato.linhas.length;
    
    const start = startDate.toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];
    
    return dadosExtrato.linhas.filter(linha => 
      linha.data >= start && linha.data <= end
    ).length;
  }, [startDate, endDate, dadosExtrato.linhas]);

  // Validation
  const isValidPeriod = useMemo(() => {
    if (!startDate || !endDate) return false;
    return startDate <= endDate && filteredCount > 0;
  }, [startDate, endDate, filteredCount]);

  const handleQuickSelect = (option: typeof quickOptions[0]) => {
    const { inicio, fim } = option.getValue();
    setStartDate(inicio);
    setEndDate(fim);
  };

  const handleExport = async (format: 'csv' | 'pdf') => {
    if (!isValidPeriod) return;

    setIsExporting(true);
    try {
      await onExport({
        startDate: startDate!.toISOString().split('T')[0],
        endDate: endDate!.toISOString().split('T')[0],
        format
      });
      onClose();
    } catch (error) {
      console.error('Erro na exportação:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-6">
          {/* Quick Options */}
          <div>
            <Label className="text-sm font-medium">Períodos predefinidos</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {quickOptions.map((option) => (
                <Button
                  key={option.label}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSelect(option)}
                  className="justify-start"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Custom Period Selection */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Período personalizado</Label>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Start Date */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Data início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* End Date */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Data fim</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Preview */}
          {startDate && endDate && (
            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                {isValidPeriod ? (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span>{filteredCount} transações encontradas no período</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <span className="text-amber-600">
                      {filteredCount === 0 ? 'Nenhuma transação encontrada' : 'Período inválido'}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Export Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            
            <div className="flex gap-2 flex-1">
              <Button
                variant="outline"
                onClick={() => handleExport('csv')}
                disabled={!isValidPeriod || isExporting}
                className="flex-1"
              >
                {isExporting ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <List className="w-4 h-4 mr-1" />
                    CSV
                  </>
                )}
              </Button>
              
              <Button
                onClick={() => handleExport('pdf')}
                disabled={!isValidPeriod || isExporting}
                className="flex-1"
              >
                {isExporting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-1" />
                    PDF
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}