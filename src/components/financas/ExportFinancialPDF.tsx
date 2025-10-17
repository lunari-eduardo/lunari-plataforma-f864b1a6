import { useState } from 'react';
import { Download, FileText, Calendar, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useFinancialExport } from '@/hooks/useFinancialExport';
import { formatCurrency } from '@/utils/financialUtils';
import { cn } from '@/lib/utils';

const MONTHS = [
  { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
];

const YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

interface ExportFinancialPDFProps {
  variant?: 'button' | 'dropdown';
  className?: string;
}

export default function ExportFinancialPDF({ variant = 'dropdown', className }: ExportFinancialPDFProps) {
  const {
    config,
    exportData,
    exportSummary,
    canExport,
    openExportModal,
    closeExportModal,
    updateConfig,
    generatePDF
  } = useFinancialExport();

  const [showDropdown, setShowDropdown] = useState(false);

  if (!canExport) {
    return (
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          disabled
          className={cn("gap-2", className)}
        >
          <Download className="w-4 h-4" />
          Exportar PDF
        </Button>
        <div className="absolute top-full left-0 mt-1 p-2 bg-muted text-muted-foreground text-xs rounded border whitespace-nowrap z-10 opacity-0 pointer-events-none group-hover:opacity-100">
          Complete as informações da empresa em "Minha Conta"
        </div>
      </div>
    );
  }

  if (variant === 'button') {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => openExportModal('monthly')}
          className={cn("gap-2", className)}
        >
          <Download className="w-4 h-4" />
          Exportar PDF
        </Button>

        <ExportConfigModal />
      </>
    );
  }

  return (
    <>
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDropdown(!showDropdown)}
          className={cn("gap-2", className)}
        >
          <Download className="w-4 h-4" />
          Exportar PDF
        </Button>

        {showDropdown && (
          <div className="absolute top-full right-0 mt-2 w-48 bg-card border border-border rounded-md shadow-lg z-50">
            <div className="p-2 space-y-1">
              <button
                onClick={() => {
                  openExportModal('monthly');
                  setShowDropdown(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted rounded-sm transition-colors"
              >
                <FileText className="w-4 h-4" />
                Extrato Mensal
              </button>
              <button
                onClick={() => {
                  openExportModal('annual');
                  setShowDropdown(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted rounded-sm transition-colors"
              >
                <Calendar className="w-4 h-4" />
                Relatório Anual
              </button>
            </div>
          </div>
        )}
      </div>

      <ExportConfigModal />
    </>
  );

  function ExportConfigModal() {
    return (
      <Dialog open={config.isOpen} onOpenChange={closeExportModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {config.type === 'annual' ? <Calendar className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
              {config.type === 'annual' ? 'Relatório Anual' : 'Extrato Mensal'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Company Info */}
            {exportData && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    Empresa
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="font-medium">{exportData.profile.empresa || exportData.profile.nome}</p>
                  {exportData.profile.cpf_cnpj && (
                    <p className="text-xs text-muted-foreground">{exportData.profile.cpf_cnpj}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Period Selection */}
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                {config.type === 'monthly' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Mês</label>
                    <Select
                      value={config.selectedMonth.toString()}
                      onValueChange={(value) => updateConfig({ selectedMonth: parseInt(value) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map(month => (
                          <SelectItem key={month.value} value={month.value.toString()}>
                            {month.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ano</label>
                  <Select
                    value={config.selectedYear.toString()}
                    onValueChange={(value) => updateConfig({ selectedYear: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {YEARS.map(year => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Options */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-details"
                  checked={config.includeDetails}
                  onCheckedChange={(checked) => updateConfig({ includeDetails: !!checked })}
                />
                <label
                  htmlFor="include-details"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  Incluir detalhamento completo
                </label>
              </div>
            </div>

            {/* Summary Preview */}
            {exportSummary && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Resumo do Período</CardTitle>
                  <CardDescription>
                    {config.type === 'annual' 
                      ? `Ano de ${config.selectedYear}`
                      : `${MONTHS[config.selectedMonth - 1].label}/${config.selectedYear}`
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Receitas</p>
                      <p className="font-medium text-green-600">{formatCurrency(exportSummary.totalReceitas)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Despesas</p>
                      <p className="font-medium text-red-600">{formatCurrency(exportSummary.totalDespesas)}</p>
                    </div>
                    <div className="col-span-2 pt-2 border-t">
                      <p className="text-muted-foreground">Saldo Final</p>
                      <p className={cn(
                        "font-bold text-lg",
                        exportSummary.saldoFinal >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {formatCurrency(exportSummary.saldoFinal)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <Badge variant="secondary" className="text-xs">
                      {exportSummary.transacoesPagas} Pagas
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {exportSummary.transacoesFaturadas} Faturadas
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {exportSummary.transacoesAgendadas} Agendadas
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={closeExportModal}
                className="flex-1"
                disabled={config.isGenerating}
              >
                Cancelar
              </Button>
              <Button
                onClick={generatePDF}
                className="flex-1"
                disabled={config.isGenerating || !exportData}
              >
                {config.isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Gerar PDF
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
}