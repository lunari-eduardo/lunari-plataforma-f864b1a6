import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppContext } from '@/contexts/AppContext';
import { Cliente } from '@/types/cliente';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, useDialogDropdownContext } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SelectModal as Select, SelectModalContent as SelectContent, SelectModalItem as SelectItem, SelectModalTrigger as SelectTrigger, SelectModalValue as SelectValue } from '@/components/ui/select-in-modal';
import { Search, UserPlus, User, Phone, Mail, Edit, Trash2, MessageCircle, Cake, LayoutGrid, List, ChevronUp, ChevronDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from 'sonner';
import { useClientMetrics, ClientMetrics } from '@/hooks/useClientMetrics';
import { useClientesRealtime } from '@/hooks/useClientesRealtime';
import { formatCurrency } from '@/utils/financialUtils';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { abrirWhatsApp } from '@/utils/whatsappUtils';
import { ORIGENS_PADRAO } from '@/utils/defaultOrigens';
import { OriginBadge } from '@/components/shared/OriginBadge';
import { AniversariantesModal } from '@/components/crm/AniversariantesModal';
import { ClientFiltersBar, ClientFilters } from '@/components/crm/ClientFiltersBar';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useClienteDuplicateCheck } from '@/hooks/useClienteDuplicateCheck';
import { ClienteSuggestionsCard } from '@/components/clientes/ClienteSuggestionsCard';
import { DuplicateWarningDialog } from '@/components/clientes/DuplicateWarningDialog';
export default function Clientes() {
  // New Supabase real-time client management
  const {
    clientes: clientesSupabase,
    isLoading: isLoadingSupabase,
    adicionarCliente: adicionarClienteSupabase,
    atualizarCliente: atualizarClienteSupabase,
    removerCliente: removerClienteSupabase,
    verificarClienteTemDados,
    searchClientes
  } = useClientesRealtime();

  // Legacy context for workflow integration (to be migrated in Step 2)
  const {
    workflowItems
  } = useAppContext();
  const dropdownContext = useDialogDropdownContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<ClientFilters>({
    filtro: '',
    dataInicio: '',
    dataFim: '',
    categoria: 'todas'
  });
  const [showClientForm, setShowClientForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Cliente | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    origem: ''
  });
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});
  const [showAniversariantesModal, setShowAniversariantesModal] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  
  // Estados para prevenção de duplicatas
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [forceCreate, setForceCreate] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    key: 'nome' | 'totalFaturado' | 'totalPago' | 'aReceber' | 'sessoes';
    direction: 'asc' | 'desc';
  } | null>(null);
  const {
    dialogState,
    confirm,
    handleConfirm,
    handleCancel,
    handleClose
  } = useConfirmDialog();

  // Check for openBirthdays parameter and auto-open modal
  useEffect(() => {
    if (searchParams.get('openBirthdays') === 'true') {
      setShowAniversariantesModal(true);
      // Remove the parameter from URL
      searchParams.delete('openBirthdays');
      setSearchParams(searchParams, {
        replace: true
      });
    }
  }, [searchParams, setSearchParams]);

  // Convert Supabase clients to legacy format for metrics compatibility
  const clientesLegacy: Cliente[] = useMemo(() => {
    return clientesSupabase.map(cliente => ({
      id: cliente.id,
      nome: cliente.nome,
      email: cliente.email || '',
      telefone: cliente.telefone,
      whatsapp: cliente.whatsapp,
      endereco: cliente.endereco,
      observacoes: cliente.observacoes,
      origem: cliente.origem,
      dataNascimento: cliente.data_nascimento,
      conjuge: cliente.familia.find(f => f.tipo === 'conjuge') ? {
        nome: cliente.familia.find(f => f.tipo === 'conjuge')?.nome,
        dataNascimento: cliente.familia.find(f => f.tipo === 'conjuge')?.data_nascimento
      } : undefined,
      filhos: cliente.familia.filter(f => f.tipo === 'filho').map(f => ({
        id: f.id,
        nome: f.nome,
        dataNascimento: f.data_nascimento
      }))
    }));
  }, [clientesSupabase]);

  // Obter métricas dos clientes
  const clientMetrics = useClientMetrics(clientesLegacy);
  
  // Hook para verificar duplicatas (convertendo de clientesLegacy para array de Cliente)
  const clientesParaDuplicateCheck = useMemo(() => {
    return clientesSupabase.map(c => ({
      id: c.id,
      nome: c.nome,
      email: c.email || '',
      telefone: c.telefone,
      whatsapp: c.whatsapp,
      endereco: c.endereco,
      observacoes: c.observacoes,
      origem: c.origem
    }));
  }, [clientesSupabase]);
  
  const duplicateCheck = useClienteDuplicateCheck(
    formData.nome,
    clientesParaDuplicateCheck,
    editingClient?.id
  );

  // Estado para armazenar IDs de clientes que passaram no filtro de sessões
  const [clientesFiltradosPorSessao, setClientesFiltradosPorSessao] = useState<Set<string> | null>(null);
  const [isLoadingSessionFilter, setIsLoadingSessionFilter] = useState(false);

  // Buscar clientes que tiveram sessões no período/categoria especificados
  useEffect(() => {
    const filtrarPorSessoes = async () => {
      // Se não há filtros de período/categoria, limpar filtro
      if (!filters.dataInicio && !filters.dataFim && (!filters.categoria || filters.categoria === 'todas')) {
        setClientesFiltradosPorSessao(null);
        return;
      }

      setIsLoadingSessionFilter(true);

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setClientesFiltradosPorSessao(null);
          return;
        }

        let query = supabase
          .from('clientes_sessoes')
          .select('cliente_id')
          .eq('user_id', user.id);

        // Filtrar por data início
        if (filters.dataInicio) {
          query = query.gte('data_sessao', filters.dataInicio);
        }

        // Filtrar por data fim
        if (filters.dataFim) {
          query = query.lte('data_sessao', filters.dataFim);
        }

        // Filtrar por categoria
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

        // Extrair IDs únicos de clientes
        const clienteIds = new Set<string>(data?.map(s => s.cliente_id as string) || []);
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

  // Force cleanup on unmount
  useEffect(() => {
    return () => {
      // Force close any open dropdowns
      setOpenDropdowns({});
      dropdownContext?.setHasOpenDropdown(false);

      // Aggressive cleanup of Radix Select portals
      document.querySelectorAll('[data-radix-select-content]').forEach(el => {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });

      // Reset pointer events on any stuck overlays
      document.querySelectorAll('[data-radix-select-trigger]').forEach(el => {
        (el as HTMLElement).style.pointerEvents = '';
      });
    };
  }, [dropdownContext]);

  // Prevent modal from closing when clicking on dropdowns
  const handleSelectOpenChange = useCallback((open: boolean, selectType: string) => {
    console.log('🔽 Select open changed:', {
      selectType,
      open
    });
    setOpenDropdowns(prev => ({
      ...prev,
      [selectType]: open
    }));
    dropdownContext?.setHasOpenDropdown(Object.values({
      ...openDropdowns,
      [selectType]: open
    }).some(Boolean));
  }, [dropdownContext, openDropdowns]);
  const handleModalClose = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      // Force close all dropdowns before closing modal
      setOpenDropdowns({});
      dropdownContext?.setHasOpenDropdown(false);

      // Cleanup portal elements immediately
      setTimeout(() => {
        document.querySelectorAll('[data-radix-select-content]').forEach(el => {
          if (el.parentNode) {
            el.parentNode.removeChild(el);
          }
        });
      }, 50);
      
      // Resetar formulário e estados de duplicata
      setEditingClient(null);
      setFormData({
        nome: '',
        email: '',
        telefone: '',
        origem: ''
      });
      setShowSuggestions(true);
      setShowDuplicateDialog(false);
      setForceCreate(false);
    }
    setShowClientForm(newOpen);
  }, [dropdownContext]);

  // Filtrar clientes
  const clientesFiltrados = useMemo(() => {
    const filtroLower = filters.filtro.toLowerCase();
    
    return clientMetrics.filter(cliente => {
      // Filtro de busca por nome/email/telefone - com verificação de null
      const nomeMatch = cliente.nome?.toLowerCase().includes(filtroLower) ?? false;
      const emailMatch = cliente.email?.toLowerCase().includes(filtroLower) ?? false;
      const telefoneMatch = cliente.telefone?.includes(filters.filtro) ?? false;
      
      const buscaMatch = nomeMatch || emailMatch || telefoneMatch;

      // Filtro de sessões por período/categoria
      const sessaoMatch = 
        clientesFiltradosPorSessao === null || // Sem filtro de sessão
        clientesFiltradosPorSessao.has(cliente.id); // Cliente está na lista filtrada

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
        return sortConfig.direction === 'asc' ? String(aValue).localeCompare(String(bValue)) : String(bValue).localeCompare(String(aValue));
      }

      // Valores numéricos
      const aNum = Number(aValue) || 0;
      const bNum = Number(bValue) || 0;
      return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
    });
  }, [clientesFiltrados, sortConfig]);
  const handleSort = (key: typeof sortConfig['key']) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({
      key,
      direction
    });
  };
  const SortableHeader = ({
    label,
    sortKey
  }: {
    label: string;
    sortKey: typeof sortConfig['key'];
  }) => {
    const isActive = sortConfig?.key === sortKey;
    const direction = sortConfig?.direction;
    return <TableHead className="cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort(sortKey)}>
        <div className="flex items-center gap-2">
          {label}
          <div className="flex flex-col">
            <ChevronUp className={`h-3 w-3 -mb-1 ${isActive && direction === 'asc' ? 'text-primary' : 'text-muted-foreground/30'}`} />
            <ChevronDown className={`h-3 w-3 ${isActive && direction === 'desc' ? 'text-primary' : 'text-muted-foreground/30'}`} />
          </div>
        </div>
      </TableHead>;
  };
  const handleAddClient = () => {
    setEditingClient(null);
    setFormData({
      nome: '',
      email: '',
      telefone: '',
      origem: ''
    });
    // Resetar estados de duplicata
    setShowSuggestions(true);
    setShowDuplicateDialog(false);
    setForceCreate(false);
    setShowClientForm(true);
  };
  const handleEditClient = (client: ClientMetrics) => {
    setEditingClient(client as Cliente);
    setFormData({
      nome: client.nome,
      email: client.email,
      telefone: client.telefone,
      origem: (client as any).origem || ''
    });
    setShowClientForm(true);
  };
  const handleDeleteClient = async (clientId: string) => {
    // 1. Verificar se o cliente tem dados vinculados
    const {
      temDados,
      sessoes,
      pagamentos
    } = await verificarClienteTemDados(clientId);
    if (temDados) {
      // Criar mensagem detalhada
      let mensagem = 'Este cliente possui dados vinculados e não pode ser excluído:\n\n';
      if (sessoes > 0) {
        mensagem += `• ${sessoes} sessão/sessões no histórico\n`;
      }
      if (pagamentos > 0) {
        mensagem += `• ${pagamentos} pagamento(s) registrado(s)\n`;
      }
      toast.error(mensagem, {
        duration: 6000,
        description: 'Para manter a integridade dos dados, clientes com histórico não podem ser removidos.'
      });
      return;
    }

    // 2. Se não tem dados, prosseguir com confirmação
    const confirmed = await confirm({
      title: "Excluir Cliente",
      description: "Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.",
      confirmText: "Excluir",
      cancelText: "Cancelar",
      variant: "destructive"
    });
    if (confirmed) {
      try {
        await removerClienteSupabase(clientId);
        toast.success('Cliente excluído com sucesso');
      } catch (error) {
        // Error handling is done in the hook
      }
    }
  };
  const handleSaveClient = async () => {
    if (!formData.nome || !formData.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    
    // Verificar duplicata apenas se não estiver editando e não for criação forçada
    if (!editingClient && !forceCreate && duplicateCheck.isDuplicata) {
      setShowDuplicateDialog(true);
      return;
    }
    try {
      if (editingClient) {
        await atualizarClienteSupabase(editingClient.id, formData);
        toast.success('Cliente atualizado com sucesso');
      } else {
        await adicionarClienteSupabase(formData);
        toast.success('Cliente adicionado com sucesso');
      }
      setShowClientForm(false);
      setEditingClient(null);
      setFormData({
        nome: '',
        email: '',
        telefone: '',
        origem: ''
      });
      
      // Resetar estados de duplicata
      setShowSuggestions(true);
      setShowDuplicateDialog(false);
      setForceCreate(false);
    } catch (error) {
      // Error handling is done in the hook
    }
  };
  
  // Funções para lidar com duplicatas
  const handleEditSuggestion = (cliente: Cliente) => {
    // Converter Cliente para o formato esperado
    const clienteLegacy = clientMetrics.find(c => c.id === cliente.id);
    if (clienteLegacy) {
      setShowClientForm(false);
      setShowSuggestions(true);
      setShowDuplicateDialog(false);
      setForceCreate(false);
      
      // Pequeno delay para evitar problemas com o modal
      setTimeout(() => {
        handleEditClient(clienteLegacy);
      }, 100);
    }
  };
  
  const handleDismissSuggestions = () => {
    setShowSuggestions(false);
  };
  
  const handleEditDuplicate = () => {
    if (duplicateCheck.clienteDuplicado) {
      handleEditSuggestion(duplicateCheck.clienteDuplicado);
    }
  };
  
  const handleCreateAnyway = () => {
    setForceCreate(true);
    setShowDuplicateDialog(false);
    
    // Adicionar sufixo ao nome para diferenciar
    const suffixMatch = formData.nome.match(/\((\d+)\)$/);
    const nextNumber = suffixMatch ? parseInt(suffixMatch[1]) + 1 : 2;
    const newName = suffixMatch 
      ? formData.nome.replace(/\(\d+\)$/, `(${nextNumber})`)
      : `${formData.nome} (${nextNumber})`;
    
    setFormData(prev => ({ ...prev, nome: newName }));
    
    toast.info(`Nome alterado para "${newName}" para evitar duplicação`);
  };
  
  const handleCancelDuplicate = () => {
    setShowDuplicateDialog(false);
  };
  const handleWhatsApp = (cliente: ClientMetrics) => {
    const telefone = cliente.telefone.replace(/\D/g, '');
    const mensagem = `Olá ${cliente.nome}! 😊\n\nComo você está? Espero que esteja tudo bem!\n\nEstou entrando em contato para...`;
    const mensagemCodificada = encodeURIComponent(mensagem);
    const link = `https://wa.me/55${telefone}?text=${mensagemCodificada}`;
    window.open(link, '_blank');
  };
  const limparFiltros = () => {
    setFilters({
      filtro: '',
      dataInicio: '',
      dataFim: '',
      categoria: 'todas'
    });
  };
  return <ScrollArea className="h-[calc(100vh-120px)]">
      <div className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 space-y-6 py-px">
        {/* Migration Helper */}
        

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            
            <p className="text-muted-foreground">
              {isLoadingSupabase ? 'Carregando...' : `${clientesSupabase.length} cliente(s) cadastrado(s)`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Toggle de visualização */}
            <div className="flex items-center border border-lunar-border rounded-lg overflow-hidden">
              <Button variant={viewMode === 'cards' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('cards')} className={viewMode === 'cards' ? "rounded-none" : "rounded-none"}>
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('list')} className={viewMode === 'list' ? "rounded-none" : "rounded-none"}>
                <List className="h-4 w-4" />
              </Button>
            </div>

            <Button variant="outline" onClick={() => setShowAniversariantesModal(true)} className="flex items-center gap-2">
              <Cake className="h-4 w-4" />
              Aniversariantes
            </Button>
            <Button onClick={handleAddClient} className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Novo Cliente
            </Button>
          </div>
        </div>
        
        {/* Filtros */}
        <ClientFiltersBar filters={filters} onFiltersChange={setFilters} totalClients={clientMetrics.length} filteredClients={clientesFiltrados.length} />

        {/* Visualização em Lista */}
        {viewMode === 'list' && <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader label="Nome" sortKey="nome" />
                  <SortableHeader label="Total" sortKey="totalFaturado" />
                  <SortableHeader label="Pago" sortKey="totalPago" />
                  <SortableHeader label="A Receber" sortKey="aReceber" />
                  <SortableHeader label="Sessões" sortKey="sessoes" />
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientesOrdenados.map(cliente => <TableRow key={cliente.id}>
                    <TableCell>
                      <Link to={`/app/clientes/${cliente.id}`} className="font-medium text-primary hover:text-primary/80">
                        {cliente.nome}
                      </Link>
                      {(cliente as any).origem && <div className="mt-1">
                          <OriginBadge originId={(cliente as any).origem} />
                        </div>}
                    </TableCell>
                    <TableCell className="font-semibold text-primary">
                      {formatCurrency(cliente.totalFaturado)}
                    </TableCell>
                    <TableCell className="font-semibold text-green-600">
                      {formatCurrency(cliente.totalPago)}
                    </TableCell>
                    <TableCell className="font-semibold text-orange-600">
                      {formatCurrency(cliente.aReceber)}
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">
                        {cliente.sessoes}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs rounded-full ${cliente.totalFaturado > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {cliente.totalFaturado > 0 ? 'Ativo' : 'Novo'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleWhatsApp(cliente)} className="h-8 w-8 p-0 text-green-600 hover:text-green-700">
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEditClient(cliente)} className="h-8 w-8 p-0">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteClient(cliente.id)} className="h-8 w-8 p-0 text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>)}
              </TableBody>
            </Table>
          </div>}

        {/* Grid de Clientes - Cards */}
        {viewMode === 'cards' && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clientesOrdenados.map(cliente => <Card key={cliente.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                {/* Header do Card */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <Link to={`/app/clientes/${cliente.id}`} className="text-lg font-semibold text-primary hover:text-primary/80 block">
                      {cliente.nome}
                    </Link>
                    
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleWhatsApp(cliente)} className="h-8 w-8 p-0 text-green-600 hover:text-green-700">
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleEditClient(cliente)} className="h-8 w-8 p-0">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteClient(cliente.id)} className="h-8 w-8 p-0 text-red-600 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Informações de Contato */}
                

                {/* Métricas Financeiras */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Total</p>
                    <p className="text-sm font-semibold text-primary">
                      {formatCurrency(cliente.totalFaturado)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Pago</p>
                    <p className="text-sm font-semibold text-green-600">
                      {formatCurrency(cliente.totalPago)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">A Receber</p>
                    <p className="text-sm font-semibold text-orange-600">
                      {formatCurrency(cliente.aReceber)}
                    </p>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="mt-3 pt-3 border-t flex items-center justify-between py-[3px]">
                  <span className="text-xs text-muted-foreground">
                    {cliente.sessoes} sessões
                  </span>
                  <span className={`px-2 py-1 text-xs rounded-full ${cliente.totalFaturado > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {cliente.totalFaturado > 0 ? 'Ativo' : 'Novo'}
                  </span>
                </div>
              </CardContent>
            </Card>)}
          </div>}
        
        {/* Empty State */}
        {clientesFiltrados.length === 0 && <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum cliente encontrado</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center">
              {filters.filtro || filters.dataInicio || filters.dataFim || (filters.categoria && filters.categoria !== 'todas') ? 'Não encontramos clientes com os critérios de busca informados.' : 'Adicione seus primeiros clientes para começar.'}
            </p>
            {filters.filtro || filters.dataInicio || filters.dataFim || (filters.categoria && filters.categoria !== 'todas') ? <Button onClick={limparFiltros} variant="outline">
                Limpar filtros
              </Button> : <Button onClick={handleAddClient} className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Adicionar Cliente
              </Button>}
          </div>}

        {/* Modal do Formulário de Cliente */}
        <Dialog open={showClientForm} onOpenChange={handleModalClose}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome *</Label>
                <Input 
                  id="nome" 
                  value={formData.nome} 
                  onChange={e => {
                    setFormData(prev => ({
                      ...prev,
                      nome: e.target.value
                    }));
                    // Resetar flag de criação forçada quando usuário muda o nome
                    setForceCreate(false);
                    setShowSuggestions(true);
                  }} 
                  placeholder="Nome completo"
                  className={duplicateCheck.isDuplicata ? 'border-destructive' : ''}
                />
                
                {/* Sugestões de clientes similares */}
                {!editingClient && showSuggestions && duplicateCheck.clientesSimilares.length > 0 && (
                  <ClienteSuggestionsCard
                    clientes={duplicateCheck.clientesSimilares}
                    onEditClient={handleEditSuggestion}
                    onDismiss={handleDismissSuggestions}
                  />
                )}
              </div>
              
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={formData.email} onChange={e => setFormData(prev => ({
                ...prev,
                email: e.target.value
              }))} placeholder="email@exemplo.com" />
              </div>
              
              <div>
                <Label htmlFor="telefone">Telefone</Label>
                <Input id="telefone" value={formData.telefone} onChange={e => setFormData(prev => ({
                ...prev,
                telefone: e.target.value
              }))} placeholder="(Opcional) +55 (DDD) 00000-0000" />
              </div>
              
              <div>
                <Label htmlFor="origem">Origem</Label>
                <Select value={formData.origem} onValueChange={value => setFormData(prev => ({
                ...prev,
                origem: value
              }))} onOpenChange={open => handleSelectOpenChange(open, 'origem')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {ORIGENS_PADRAO.map(origem => <SelectItem key={origem.id} value={origem.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{
                        backgroundColor: origem.cor
                      }} />
                          {origem.nome}
                        </div>
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowClientForm(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSaveClient}
                  disabled={!editingClient && !forceCreate && duplicateCheck.isDuplicata}
                >
                  {editingClient ? 'Atualizar' : 'Adicionar'}
                </Button>
              </div>
              
              {/* Aviso de duplicata bloqueada */}
              {!editingClient && !forceCreate && duplicateCheck.isDuplicata && (
                <p className="text-sm text-destructive text-center mt-2">
                  Cliente com este nome já existe. Clique em "Adicionar" para ver opções.
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog de aviso de duplicata */}
        <DuplicateWarningDialog
          open={showDuplicateDialog}
          cliente={duplicateCheck.clienteDuplicado}
          onEditExisting={handleEditDuplicate}
          onCreateAnyway={handleCreateAnyway}
          onCancel={handleCancelDuplicate}
        />

        {/* Modal de Aniversariantes */}
        <AniversariantesModal open={showAniversariantesModal} onOpenChange={setShowAniversariantesModal} clientes={clientesLegacy} />

        {/* Confirm Dialog */}
        <ConfirmDialog state={dialogState} onConfirm={handleConfirm} onCancel={handleCancel} onClose={handleClose} />
      </div>
    </ScrollArea>;
}