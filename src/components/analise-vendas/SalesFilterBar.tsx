import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Filter, X } from 'lucide-react';

interface SalesFilterBarProps {
  selectedPeriod: string;
  selectedService: string;
  selectedClient: string;
  onPeriodChange: (value: string) => void;
  onServiceChange: (value: string) => void;
  onClientChange: (value: string) => void;
}

export function SalesFilterBar({
  selectedPeriod,
  selectedService,
  selectedClient,
  onPeriodChange,
  onServiceChange,
  onClientChange
}: SalesFilterBarProps) {
  const activeFilters = [
    selectedPeriod !== 'thisMonth' && { key: 'period', label: getPeriodLabel(selectedPeriod) },
    selectedService !== 'all' && { key: 'service', label: getServiceLabel(selectedService) },
    selectedClient !== 'all' && { key: 'client', label: getClientLabel(selectedClient) },
  ].filter(Boolean);

  const clearFilter = (filterKey: string) => {
    switch (filterKey) {
      case 'period':
        onPeriodChange('thisMonth');
        break;
      case 'service':
        onServiceChange('all');
        break;
      case 'client':
        onClientChange('all');
        break;
    }
  };

  const clearAllFilters = () => {
    onPeriodChange('thisMonth');
    onServiceChange('all');
    onClientChange('all');
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row gap-3">
        <Select value={selectedPeriod} onValueChange={onPeriodChange}>
          <SelectTrigger className="w-full md:w-48 text-xs">
            <Calendar className="h-3 w-3 mr-2" />
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="thisMonth">Este Mês</SelectItem>
            <SelectItem value="lastMonth">Mês Anterior</SelectItem>
            <SelectItem value="thisQuarter">Este Trimestre</SelectItem>
            <SelectItem value="thisYear">Este Ano</SelectItem>
            <SelectItem value="lastYear">Ano Anterior</SelectItem>
            <SelectItem value="custom">Período Customizado</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedService} onValueChange={onServiceChange}>
          <SelectTrigger className="w-full md:w-48 text-xs">
            <SelectValue placeholder="Tipo de Serviço" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Serviços</SelectItem>
            <SelectItem value="ensaio-casal">Ensaio de Casal</SelectItem>
            <SelectItem value="ensaio-familia">Ensaio de Família</SelectItem>
            <SelectItem value="ensaio-gestante">Ensaio Gestante</SelectItem>
            <SelectItem value="casamento">Casamento</SelectItem>
            <SelectItem value="evento-corporativo">Evento Corporativo</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedClient} onValueChange={onClientChange}>
          <SelectTrigger className="w-full md:w-48 text-xs">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Clientes</SelectItem>
            <SelectItem value="maria-silva">Maria Silva</SelectItem>
            <SelectItem value="joao-santos">João Santos</SelectItem>
            <SelectItem value="ana-costa">Ana Costa</SelectItem>
            <SelectItem value="pedro-oliveira">Pedro Oliveira</SelectItem>
          </SelectContent>
        </Select>

        {activeFilters.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearAllFilters}
            className="text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Limpar Filtros
          </Button>
        )}
      </div>

      {/* Active Filters */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeFilters.map((filter: any) => (
            <Badge
              key={filter.key}
              variant="secondary"
              className="text-2xs flex items-center gap-1 pr-1"
            >
              {filter.label}
              <Button
                variant="ghost"
                size="sm"
                className="h-3 w-3 p-0 hover:bg-transparent"
                onClick={() => clearFilter(filter.key)}
              >
                <X className="h-2 w-2" />
              </Button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function getPeriodLabel(period: string): string {
  const labels: Record<string, string> = {
    lastMonth: 'Mês Anterior',
    thisQuarter: 'Este Trimestre',
    thisYear: 'Este Ano',
    lastYear: 'Ano Anterior',
    custom: 'Período Customizado'
  };
  return labels[period] || period;
}

function getServiceLabel(service: string): string {
  const labels: Record<string, string> = {
    'ensaio-casal': 'Ensaio de Casal',
    'ensaio-familia': 'Ensaio de Família',
    'ensaio-gestante': 'Ensaio Gestante',
    'casamento': 'Casamento',
    'evento-corporativo': 'Evento Corporativo'
  };
  return labels[service] || service;
}

function getClientLabel(client: string): string {
  const labels: Record<string, string> = {
    'maria-silva': 'Maria Silva',
    'joao-santos': 'João Santos',
    'ana-costa': 'Ana Costa',
    'pedro-oliveira': 'Pedro Oliveira'
  };
  return labels[client] || client;
}