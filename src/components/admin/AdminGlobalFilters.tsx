import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Filter } from 'lucide-react';
import type { AdminFilters } from '@/types/admin-analytics';

interface AdminGlobalFiltersProps {
  filters: AdminFilters;
  onFiltersChange: (filters: AdminFilters) => void;
  cidadesDisponiveis: string[];
  nichosDisponiveis: string[];
}

export function AdminGlobalFilters({
  filters,
  onFiltersChange,
  cidadesDisponiveis,
  nichosDisponiveis
}: AdminGlobalFiltersProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Filtros</span>
      </div>
      
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Período */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Período</label>
          <Select
            value={filters.periodo}
            onValueChange={(value) => onFiltersChange({ ...filters, periodo: value as AdminFilters['periodo'] })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mes_atual">Mês atual</SelectItem>
              <SelectItem value="ultimo_trimestre">Último trimestre</SelectItem>
              <SelectItem value="ultimo_ano">Último ano</SelectItem>
              <SelectItem value="todos">Todos os períodos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Nicho */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Nicho</label>
          <Select
            value={filters.nicho || 'todos'}
            onValueChange={(value) => onFiltersChange({ ...filters, nicho: value === 'todos' ? undefined : value })}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Todos os nichos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os nichos</SelectItem>
              {nichosDisponiveis.map((nicho) => (
                <SelectItem key={nicho} value={nicho}>{nicho}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Cidade */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Cidade</label>
          <Select
            value={filters.cidade || 'todos'}
            onValueChange={(value) => onFiltersChange({ ...filters, cidade: value === 'todos' ? undefined : value })}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Todas as cidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as cidades</SelectItem>
              {cidadesDisponiveis.map((cidade) => (
                <SelectItem key={cidade} value={cidade}>{cidade}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tipo de Usuário */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Tipo de usuário</label>
          <Select
            value={filters.tipoUsuario || 'todos'}
            onValueChange={(value) => onFiltersChange({ ...filters, tipoUsuario: value as AdminFilters['tipoUsuario'] })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="vip">VIP</SelectItem>
              <SelectItem value="autorizado">Autorizados</SelectItem>
              <SelectItem value="expirado">Expirados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
}
