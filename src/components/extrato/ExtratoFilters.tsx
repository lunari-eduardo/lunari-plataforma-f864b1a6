/**
 * Componente de filtros do extrato
 */

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FiltrosExtrato, ExtratoTipo, ExtratoOrigem, ExtratoStatus } from '@/types/extrato';

interface ExtratoFiltersProps {
  filtros: FiltrosExtrato;
  onFiltrosChange: (novosFiltros: Partial<FiltrosExtrato>) => void;
  onLimparFiltros: () => void;
}

export default function ExtratoFilters({ 
  filtros, 
  onFiltrosChange, 
  onLimparFiltros 
}: ExtratoFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-lunar-surface/50 rounded-lg border border-lunar-border/30">
      <div className="space-y-2">
        <Input 
          type="date" 
          value={filtros.dataInicio} 
          onChange={e => onFiltrosChange({ dataInicio: e.target.value })} 
          className="w-40" 
        />
      </div>
      
      <div className="space-y-2">
        <Input 
          type="date" 
          value={filtros.dataFim} 
          onChange={e => onFiltrosChange({ dataFim: e.target.value })} 
          className="w-40" 
        />
      </div>

      <div className="space-y-2">
        <Select 
          value={filtros.tipo || 'todos'} 
          onValueChange={value => onFiltrosChange({ tipo: value as ExtratoTipo | 'todos' })}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="entrada">Entradas</SelectItem>
            <SelectItem value="saida">Saídas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Select 
          value={filtros.origem || 'todos'} 
          onValueChange={value => onFiltrosChange({ origem: value as ExtratoOrigem | 'todos' })}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            <SelectItem value="workflow">Workflow</SelectItem>
            <SelectItem value="financeiro">Financeiro</SelectItem>
            <SelectItem value="cartao">Cartão</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Select 
          value={filtros.status || 'todos'} 
          onValueChange={value => onFiltrosChange({ status: value as ExtratoStatus | 'todos' })}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="Pago">Pago</SelectItem>
            <SelectItem value="Faturado">Faturado</SelectItem>
            <SelectItem value="Agendado">Agendado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Input 
          placeholder="Buscar..." 
          value={filtros.busca || ''} 
          onChange={e => onFiltrosChange({ busca: e.target.value })} 
          className="w-40" 
        />
      </div>

      <Button variant="outline" onClick={onLimparFiltros} className="h-9">
        Limpar Filtros
      </Button>
    </div>
  );
}