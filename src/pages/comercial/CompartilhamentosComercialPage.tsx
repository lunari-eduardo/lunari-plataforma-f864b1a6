import React, { useState, useMemo } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Link, useNavigate } from 'react-router-dom';
import { useAllMaterialShares } from '@/hooks/useMaterialShares';
import { format, subDays, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, FilterX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CompartilhamentosComercialPage() {
  const { shares, isLoading } = useAllMaterialShares();
  const navigate = useNavigate();

  // Filter States
  const [leadSearch, setLeadSearch] = useState('');
  const [materialFilter, setMaterialFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // all, opened, not_opened
  const [periodFilter, setPeriodFilter] = useState('all'); // all, 7d, 30d

  const uniqueMaterials = useMemo(() => {
    const map = new Map();
    shares.forEach(s => {
      if (s.material?.title && !map.has(s.material.title)) {
        map.set(s.material.title, s.material.title);
      }
    });
    return Array.from(map.values());
  }, [shares]);

  const filteredShares = useMemo(() => {
    return shares.filter(share => {
      // 1. Lead Search
      const leadName = share.lead?.nome?.toLowerCase() || '';
      if (leadSearch && !leadName.includes(leadSearch.toLowerCase())) return false;

      // 2. Material
      if (materialFilter !== 'all' && share.material?.title !== materialFilter) return false;

      // 3. Status
      const isOpened = share.sessions_count > 0;
      if (statusFilter === 'opened' && !isOpened) return false;
      if (statusFilter === 'not_opened' && isOpened) return false;

      // 4. Period
      if (periodFilter !== 'all') {
        const sentAt = new Date(share.sent_at);
        if (periodFilter === '7d' && !isAfter(sentAt, subDays(new Date(), 7))) return false;
        if (periodFilter === '30d' && !isAfter(sentAt, subDays(new Date(), 30))) return false;
      }

      return true;
    });
  }, [shares, leadSearch, materialFilter, statusFilter, periodFilter]);

  const clearFilters = () => {
    setLeadSearch('');
    setMaterialFilter('all');
    setStatusFilter('all');
    setPeriodFilter('all');
  };

  return (
    <PageContainer>
      <div className="mb-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link to="/app/comercial">Comercial</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Compartilhamentos</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <PageHeader 
        title="Compartilhamentos" 
        description="Acompanhe o status e a interação dos materiais enviados aos clientes." 
      />

      <div className="mt-8 space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 bg-card p-4 rounded-xl border shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por cliente..." 
              value={leadSearch}
              onChange={(e) => setLeadSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={materialFilter} onValueChange={setMaterialFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Material" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Materiais</SelectItem>
              {uniqueMaterials.map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="opened">Visualizados</SelectItem>
              <SelectItem value="not_opened">Não Visualizados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Qualquer data</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
          {(leadSearch || materialFilter !== 'all' || statusFilter !== 'all' || periodFilter !== 'all') && (
            <Button variant="ghost" size="icon" onClick={clearFilters} title="Limpar filtros">
              <FilterX className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="border border-border rounded-lg overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="px-6 py-4">Proposta</th>
                  <th className="px-6 py-4">Versão</th>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Enviada em</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Acessos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                      <div className="flex justify-center mb-2"><Loader2 className="h-6 w-6 animate-spin" /></div>
                      Carregando compartilhamentos...
                    </td>
                  </tr>
                ) : filteredShares.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                      Nenhum compartilhamento encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredShares.map((share: any) => (
                    <tr 
                      key={share.id} 
                      className="hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/app/comercial/compartilhamentos/${share.id}`)}
                    >
                      <td className="px-6 py-4 font-medium text-foreground">
                        {share.material?.title || 'Proposta Excluída'}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        v{share.version?.version_number || '?'}
                      </td>
                      <td className="px-6 py-4">
                        {share.lead?.nome || <span className="text-muted-foreground italic">Sem lead associado</span>}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                        {format(new Date(share.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </td>
                      <td className="px-6 py-4">
                        {share.sessions_count > 0 ? (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                            Visualizada
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground bg-muted/50">
                            Aguardando
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {share.sessions_count > 0 ? (
                          <span className="font-semibold text-foreground">{share.sessions_count}x</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
