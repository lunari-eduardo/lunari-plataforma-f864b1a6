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
import { Search, UserPlus, User, Phone, Mail, Edit, Trash2, MessageCircle, Cake } from "lucide-react";
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

export default function Clientes() {
  // New Supabase real-time client management
  const {
    clientes: clientesSupabase,
    isLoading: isLoadingSupabase,
    adicionarCliente: adicionarClienteSupabase,
    atualizarCliente: atualizarClienteSupabase,
    removerCliente: removerClienteSupabase,
    searchClientes
  } = useClientesRealtime();

  // Legacy context for workflow integration (to be migrated in Step 2)
  const { workflowItems } = useAppContext();
  const dropdownContext = useDialogDropdownContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<ClientFilters>({
    filtro: '',
    statusFilter: 'todos',
    faturadoFilter: 'todos',
    pagoFilter: 'todos',
    receberFilter: 'todos'
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
      filhos: cliente.familia
        .filter(f => f.tipo === 'filho')
        .map(f => ({
          id: f.id,
          nome: f.nome,
          dataNascimento: f.data_nascimento
        }))
    }));
  }, [clientesSupabase]);

  // Obter métricas dos clientes
  const clientMetrics = useClientMetrics(clientesLegacy);

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
    }
    setShowClientForm(newOpen);
  }, [dropdownContext]);

  // Filtrar clientes
  const clientesFiltrados = useMemo(() => {
    return clientMetrics.filter(cliente => {
      const nomeMatch = cliente.nome.toLowerCase().includes(filters.filtro.toLowerCase()) || cliente.email.toLowerCase().includes(filters.filtro.toLowerCase()) || cliente.telefone.includes(filters.filtro);
      const faturadoMatch = !filters.faturadoFilter || filters.faturadoFilter === 'todos' || filters.faturadoFilter === 'baixo' && cliente.totalFaturado < 1000 || filters.faturadoFilter === 'medio' && cliente.totalFaturado >= 1000 && cliente.totalFaturado < 5000 || filters.faturadoFilter === 'alto' && cliente.totalFaturado >= 5000;
      const pagoMatch = !filters.pagoFilter || filters.pagoFilter === 'todos' || filters.pagoFilter === 'baixo' && cliente.totalPago < 1000 || filters.pagoFilter === 'medio' && cliente.totalPago >= 1000 && cliente.totalPago < 5000 || filters.pagoFilter === 'alto' && cliente.totalPago >= 5000;
      const receberMatch = !filters.receberFilter || filters.receberFilter === 'todos' || filters.receberFilter === 'baixo' && cliente.aReceber < 1000 || filters.receberFilter === 'medio' && cliente.aReceber >= 1000 && cliente.aReceber < 5000 || filters.receberFilter === 'alto' && cliente.aReceber >= 5000;
      return nomeMatch && faturadoMatch && pagoMatch && receberMatch;
    });
  }, [clientMetrics, filters]);
  const handleAddClient = () => {
    setEditingClient(null);
    setFormData({
      nome: '',
      email: '',
      telefone: '',
      origem: ''
    });
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
    if (!formData.nome || !formData.telefone) {
      toast.error('Nome e telefone são obrigatórios');
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
    } catch (error) {
      // Error handling is done in the hook
    }
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
      statusFilter: 'todos',
      faturadoFilter: 'todos',
      pagoFilter: 'todos',
      receberFilter: 'todos'
    });
  };
  return <ScrollArea className="h-[calc(100vh-120px)]">
      <div className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 space-y-6 py-px">
        {/* Migration Helper */}
        

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
            <p className="text-muted-foreground">
              {isLoadingSupabase ? 'Carregando...' : `${clientesSupabase.length} cliente(s) cadastrado(s)`}
            </p>
          </div>
          <div className="flex items-center gap-2">
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

        {/* Grid de Clientes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clientesFiltrados.map(cliente => <Card key={cliente.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                {/* Header do Card */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <Link to={`/clientes/${cliente.id}`} className="text-lg font-semibold text-primary hover:text-primary/80 block">
                      {cliente.nome}
                    </Link>
                    <p className="text-muted-foreground text-xs">{cliente.email}</p>
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
                <div className="flex items-center justify-between mb-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3" />
                    <span className="text-xs">{cliente.telefone}</span>
                  </div>
                  <OriginBadge originId={(cliente as any).origem} className="text-xs" />
                </div>

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
        </div>
        
        {/* Empty State */}
        {clientesFiltrados.length === 0 && <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum cliente encontrado</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center">
              {filters.filtro || filters.statusFilter && filters.statusFilter !== 'todos' || filters.faturadoFilter && filters.faturadoFilter !== 'todos' || filters.pagoFilter && filters.pagoFilter !== 'todos' || filters.receberFilter && filters.receberFilter !== 'todos' ? 'Não encontramos clientes com os critérios de busca informados.' : 'Adicione seus primeiros clientes para começar.'}
            </p>
            {filters.filtro || filters.statusFilter && filters.statusFilter !== 'todos' || filters.faturadoFilter && filters.faturadoFilter !== 'todos' || filters.pagoFilter && filters.pagoFilter !== 'todos' || filters.receberFilter && filters.receberFilter !== 'todos' ? <Button onClick={limparFiltros} variant="outline">
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
                <Input id="nome" value={formData.nome} onChange={e => setFormData(prev => ({
                ...prev,
                nome: e.target.value
              }))} placeholder="Nome completo" />
              </div>
              
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={formData.email} onChange={e => setFormData(prev => ({
                ...prev,
                email: e.target.value
              }))} placeholder="email@exemplo.com" />
              </div>
              
              <div>
                <Label htmlFor="telefone">Telefone *</Label>
                <Input id="telefone" value={formData.telefone} onChange={e => setFormData(prev => ({
                ...prev,
                telefone: e.target.value
              }))} placeholder="+55 (DDD) 00000-0000" />
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
                <Button onClick={handleSaveClient}>
                  {editingClient ? 'Atualizar' : 'Adicionar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Aniversariantes */}
        <AniversariantesModal open={showAniversariantesModal} onOpenChange={setShowAniversariantesModal} clientes={clientesLegacy} />

        {/* Confirm Dialog */}
        <ConfirmDialog state={dialogState} onConfirm={handleConfirm} onCancel={handleCancel} onClose={handleClose} />
      </div>
    </ScrollArea>;
}