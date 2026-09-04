import { useState, useMemo, useEffect } from 'react';
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
import { DadosExportacaoExtrato, RegimeContabil } from '@/types/extrato';
import { formatDateForStorage, parseDateFromStorage } from '@/utils/dateUtils';
import { supabase } from '@/integrations/supabase/client';

interface PeriodSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (params: {
    startDate: string;
    endDate: string;
    format: 'csv' | 'pdf';
  }) => Promise<void>;
  dadosExtrato?: DadosExportacaoExtrato;
  title: string;
  description?: string;
  regime?: RegimeContabil;
}

export default function PeriodSelectionModal({
  isOpen,
  onClose,
  onExport,
  dadosExtrato,
  title,
  description,
  regime = 'caixa'
}: PeriodSelectionModalProps) {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [isExporting, setIsExporting] = useState(false);
  const [serverCount, setServerCount] = useState<number | null>(null);
  const [isLoadingCount, setIsLoadingCount] = useState(false);

  // Inicializa com o período corrente da tela ao abrir
  useEffect(() => {
    if (isOpen && dadosExtrato?.periodo?.inicio && dadosExtrato?.periodo?.fim) {
      setStartDate(parseDateFromStorage(dadosExtrato.periodo.inicio));
      setEndDate(parseDateFromStorage(dadosExtrato.periodo.fim));
    }
  }, [isOpen, dadosExtrato?.periodo?.inicio, dadosExtrato?.periodo?.fim]);

  // Ano de referência baseado no período atual ou ano corrente
  const anoBase = dadosExtrato?.periodo?.inicio
    ? parseDateFromStorage(dadosExtrato.periodo.inicio).getFullYear()
    : new Date().getFullYear();

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
      label: `Ano todo (${anoBase})`,
      getValue: () => {
        const inicio = new Date(anoBase, 0, 1);
        const fim = new Date(anoBase, 11, 31);
        return { inicio, fim };
      }
    }
  ];

  // Busca a contagem real de transações do período
  useEffect(() => {
    if (!isOpen || !startDate || !endDate) {
      setServerCount(null);
      setIsLoadingCount(false);
      return;
    }

    if (startDate > endDate) {
      setServerCount(0);
      setIsLoadingCount(false);
      return;
    }

    const startStr = formatDateForStorage(startDate);
    const endStr = formatDateForStorage(endDate);

    // Se for exatamente o mesmo período da tela e tivermos as linhas em memória
    if (
      dadosExtrato?.periodo?.inicio === startStr &&
      dadosExtrato?.periodo?.fim === endStr &&
      Array.isArray(dadosExtrato?.linhas)
    ) {
      setServerCount(dadosExtrato.linhas.length);
      setIsLoadingCount(false);
      return;
    }

    let isMounted = true;
    setIsLoadingCount(true);

    const fetchCount = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (isMounted) {
            const localCount = dadosExtrato?.linhas?.filter(linha => 
              linha.data >= startStr && linha.data <= endStr
            ).length || 0;
            setServerCount(localCount);
            setIsLoadingCount(false);
          }
          return;
        }

        const dataColumn = regime === 'competencia' ? 'data_competencia' : 'data';
        let query = supabase
          .from('extrato_unificado')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte(dataColumn, startStr)
          .lte(dataColumn, endStr);

        if (dadosExtrato?.filtrosAplicados?.status && dadosExtrato.filtrosAplicados.status !== 'todos') {
          query = query.eq('status', dadosExtrato.filtrosAplicados.status);
        } else if (regime === 'caixa') {
          query = query.eq('status', 'Pago');
        } else if (regime === 'competencia') {
          query = query.in('status', ['Pago', 'Faturado']);
        }

        const { count, error } = await query;
        if (error) throw error;

        if (isMounted) {
          setServerCount(count ?? 0);
          setIsLoadingCount(false);
        }
      } catch (err) {
        console.error('Erro ao contar transações do período:', err);
        if (isMounted) {
          const localCount = dadosExtrato?.linhas?.filter(linha => 
            linha.data >= startStr && linha.data <= endStr
          ).length || 0;
          setServerCount(localCount);
          setIsLoadingCount(false);
        }
      }
    };

    fetchCount();

    return () => {
      isMounted = false;
    };
  }, [isOpen, startDate, endDate, regime, dadosExtrato]);

  // Validation
  const isValidPeriod = useMemo(() => {
    if (!startDate || !endDate) return false;
    if (startDate > endDate) return false;
    if (serverCount !== null) return serverCount > 0;
    return true;
  }, [startDate, endDate, serverCount]);

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
        startDate: formatDateForStorage(startDate!),
        endDate: formatDateForStorage(endDate!),
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
                {startDate > endDate ? (
                  <>
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-amber-600">
                      A data de início deve ser anterior ou igual à data fim
                    </span>
                  </>
                ) : isLoadingCount ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                    <span className="text-muted-foreground">
                      Contando transações no período...
                    </span>
                  </>
                ) : isValidPeriod && (serverCount === null || serverCount > 0) ? (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full shrink-0" />
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">
                      {(serverCount ?? 0).toLocaleString('pt-BR')} {(serverCount ?? 0) === 1 ? 'transação encontrada' : 'transações encontradas'} no período
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-amber-600">
                      Nenhuma transação encontrada no período
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
                disabled={!isValidPeriod || isExporting || isLoadingCount}
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
                disabled={!isValidPeriod || isExporting || isLoadingCount}
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