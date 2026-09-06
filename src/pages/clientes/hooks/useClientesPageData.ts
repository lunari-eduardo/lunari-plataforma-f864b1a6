import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Cliente } from '@/types/cliente';
import { useClientesRealtime } from '@/hooks/useClientesRealtime';
import { useClientMetrics, ClientMetrics } from '@/hooks/useClientMetrics';
import { ClientFilters } from '@/components/crm/ClientFiltersBar';
import { toast } from 'sonner';
import { SortConfig, SortKey } from '../types';

export const useClientesPageData = () => {
  const {
    clientes: clientesSupabase,
    isLoading: isLoadingSupabase,
    adicionarCliente: adicionarClienteSupabase,
    atualizarCliente: atualizarClienteSupabase,
    removerCliente: removerClienteSupabase,
    verificarClienteTemDados,
    searchClientes,
  } = useClientesRealtime();

  const [filters, setFilters] = useState<ClientFilters>({
    filtro: '',
    dataInicio: '',
    dataFim: '',
    categoria: 'todas',
  });

  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Convert Supabase clients to legacy format for metrics compatibility
  const clientesLegacy: Cliente[] = useMemo(() => {
    return clientesSupabase.map((cliente) => ({
      id: cliente.id,
      nome: cliente.nome,
      email: cliente.email || '',
      telefone: cliente.telefone,
      whatsapp: cliente.whatsapp,
      endereco: cliente.endereco,
      observacoes: cliente.observacoes,
      origem: cliente.origem,
      dataNascimento: cliente.data_nascimento,
      conjuge: cliente.familia.find((f) => f.tipo === 'conjuge')
        ? {
            nome: cliente.familia.find((f) => f.tipo === 'conjuge')?.nome,
            dataNascimento: cliente.familia.find((f) => f.tipo === 'conjuge')?.data_nascimento,
          }
        : undefined,
      filhos: cliente.familia
        .filter((f) => f.tipo === 'filho')
        .map((f) => ({
          id: f.id,
          nome: f.nome,
          dataNascimento: f.data_nascimento,
        })),
    }));
  }, [clientesSupabase]);

  // Obter métricas dos clientes
  const clientMetrics = useClientMetrics(clientesLegacy);

  // Filtro de sessões por período/categoria
  const [clientesFiltradosPorSessao, setClientesFiltradosPorSessao] = useState<Set<string> | null>(null);
  const [isLoadingSessionFilter, setIsLoadingSessionFilter] = useState(false);

  useEffect(() => {
    const filtrarPorSessoes = async () => {
      if (!filters.dataInicio && !filters.dataFim && (!filters.categoria || filters.categoria === 'todas')) {
        setClientesFiltradosPorSessao(null);
        return;
      }

      setIsLoadingSessionFilter(true);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setClientesFiltradosPorSessao(null);
          return;
        }

        let query = supabase.from('clientes_sessoes').select('cliente_id').eq('user_id', user.id);

        if (filters.dataInicio) {
          query = query.gte('data_sessao', filters.dataInicio);
        }

        if (filters.dataFim) {
          query = query.lte('data_sessao', filters.dataFim);
        }

        if (filters.categoria && filters.categoria !== 'todas') {
          query = query.eq('categoria', filters.categoria);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Erro ao filtrar sessões:', error);
          toast.error('Erro ao aplicar filtros de sessão');
          setClientesFiltradosPorSessao(null);
          return;
        }

        const clienteIds = new Set<string>(data?.map((s) => s.cliente_id as string) || []);
        setClientesFiltradosPorSessao(clienteIds);
      } catch (error) {
        console.error('Erro ao filtrar por sessões:', error);
        setClientesFiltradosPorSessao(null);
      } finally {
        setIsLoadingSessionFilter(false);
      }
    };

    filtrarPorSessoes();
  }, [filters.dataInicio, filters.dataFim, filters.categoria]);

  // Filtrar clientes
  const clientesFiltrados = useMemo(() => {
    const filtroLower = filters.filtro.toLowerCase();

    return clientMetrics.filter((cliente) => {
      const nomeMatch = cliente.nome?.toLowerCase().includes(filtroLower) ?? false;
      const emailMatch = cliente.email?.toLowerCase().includes(filtroLower) ?? false;
      const telefoneMatch = cliente.telefone?.includes(filters.filtro) ?? false;

      const buscaMatch = nomeMatch || emailMatch || telefoneMatch;
      const sessaoMatch =
        clientesFiltradosPorSessao === null || clientesFiltradosPorSessao.has(cliente.id);

      return buscaMatch && sessaoMatch;
    });
  }, [clientMetrics, filters.filtro, clientesFiltradosPorSessao]);

  // Ordenar clientes
  const clientesOrdenados = useMemo(() => {
    if (!sortConfig) return clientesFiltrados;
    return [...clientesFiltrados].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      if (sortConfig.key === 'nome') {
        return sortConfig.direction === 'asc'
          ? String(aValue).localeCompare(String(bValue))
          : String(bValue).localeCompare(String(aValue));
      }

      const aNum = Number(aValue) || 0;
      const bNum = Number(bValue) || 0;
      return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
    });
  }, [clientesFiltrados, sortConfig]);

  // Paginação
  const totalPages = Math.ceil(clientesOrdenados.length / ITEMS_PER_PAGE);
  const clientesPaginados = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return clientesOrdenados.slice(start, start + ITEMS_PER_PAGE);
  }, [clientesOrdenados, currentPage, ITEMS_PER_PAGE]);

  useEffect(() => {
    setCurrentPage(1);
  }, [clientesFiltrados.length, sortConfig]);

  const getPageNumbers = (): (number | 'ellipsis')[] => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      for (
        let i = Math.max(2, currentPage - 1);
        i <= Math.min(totalPages - 1, currentPage + 1);
        i++
      ) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };

  const handleSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({
      key,
      direction,
    });
  };

  const limparFiltros = () => {
    setFilters({
      filtro: '',
      dataInicio: '',
      dataFim: '',
      categoria: 'todas',
    });
  };

  return {
    clientesSupabase,
    isLoadingSupabase,
    adicionarClienteSupabase,
    atualizarClienteSupabase,
    removerClienteSupabase,
    verificarClienteTemDados,
    searchClientes,
    clientesLegacy,
    clientMetrics,
    filters,
    setFilters,
    limparFiltros,
    clientesFiltrados,
    sortConfig,
    handleSort,
    currentPage,
    setCurrentPage,
    totalPages,
    clientesPaginados,
    getPageNumbers,
    ITEMS_PER_PAGE,
    clientesOrdenadosCount: clientesOrdenados.length,
    isLoadingSessionFilter,
  };
};
