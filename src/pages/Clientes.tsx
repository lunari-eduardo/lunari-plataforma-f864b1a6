import { useState, useContext, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AppContext } from '@/contexts/AppContext';
import { Cliente } from '@/types/orcamentos';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, UserPlus, User, Phone, Mail, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from 'sonner';
import { useClientMetrics, ClientMetrics } from '@/hooks/useClientMetrics';
import { formatCurrency } from '@/utils/financialUtils';
import { formatDateForDisplay } from '@/utils/dateUtils';

type SortField = 'nome' | 'email' | 'telefone' | 'sessoes' | 'totalFaturado' | 'totalPago' | 'aReceber' | 'ultimaSessao';
type SortDirection = 'asc' | 'desc';

export default function Clientes() {
  const {
    clientes,
    workflowItems,
    adicionarCliente,
    atualizarCliente,
    removerCliente
  } = useContext(AppContext);

  const [filtro, setFiltro] = useState('');
  const [showClientForm, setShowClientForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Cliente | null>(null);
  const [sortField, setSortField] = useState<SortField>('nome');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: ''
  });

  // Obter métricas dos clientes
  const clientMetrics = useClientMetrics(clientes);

  // Filtrar e ordenar clientes
  const clientesFiltradosEOrdenados = useMemo(() => {
    // Aplicar filtro
    let clientesFiltrados = filtro 
      ? clientMetrics.filter(cliente => 
          cliente.nome.toLowerCase().includes(filtro.toLowerCase()) ||
          cliente.email.toLowerCase().includes(filtro.toLowerCase()) ||
          cliente.telefone.includes(filtro)
        )
      : clientMetrics;

    // Aplicar ordenação
    clientesFiltrados.sort((a, b) => {
      let valueA: any = a[sortField];
      let valueB: any = b[sortField];

      // Tratamento especial para diferentes tipos de campos
      if (sortField === 'ultimaSessao') {
        valueA = a.ultimaSessao ? a.ultimaSessao.getTime() : 0;
        valueB = b.ultimaSessao ? b.ultimaSessao.getTime() : 0;
      } else if (typeof valueA === 'string') {
        valueA = valueA.toLowerCase();
        valueB = valueB.toLowerCase();
      }

      if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return clientesFiltrados;
  }, [clientMetrics, filtro, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const handleAddClient = () => {
    setEditingClient(null);
    setFormData({
      nome: '',
      email: '',
      telefone: ''
    });
    setShowClientForm(true);
  };

  const handleEditClient = (client: ClientMetrics) => {
    setEditingClient(client as Cliente);
    setFormData({
      nome: client.nome,
      email: client.email,
      telefone: client.telefone
    });
    setShowClientForm(true);
  };

  const handleDeleteClient = (clientId: string) => {
    if (confirm('Tem certeza que deseja excluir este cliente?')) {
      removerCliente(clientId);
      toast.success('Cliente excluído com sucesso');
    }
  };

  const handleSaveClient = () => {
    if (!formData.nome || !formData.telefone) {
      toast.error('Nome e telefone são obrigatórios');
      return;
    }
    if (editingClient) {
      atualizarCliente(editingClient.id, formData);
      toast.success('Cliente atualizado com sucesso');
    } else {
      adicionarCliente(formData);
      toast.success('Cliente adicionado com sucesso');
    }
    setShowClientForm(false);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '-';
    // Usar formatDateForDisplay das dateUtils para evitar problemas de timezone
    return formatDateForDisplay(date.toISOString().split('T')[0]);
  };

  return (
    <ScrollArea className="h-[calc(100vh-120px)]">
      <div className="space-y-6 pr-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard CRM</h1>
            <p className="text-muted-foreground text-sm">
              Gerencie todos os seus clientes e acompanhe métricas de negócio em tempo real.
            </p>
          </div>
          <Button onClick={handleAddClient} className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Novo Cliente
          </Button>
        </div>
        
        <div className="flex gap-2 max-w-lg">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar clientes por nome, email ou telefone" 
              className="pl-8" 
              value={filtro} 
              onChange={e => setFiltro(e.target.value)} 
            />
          </div>
        </div>

        {/* Visualização Desktop - Tabela */}
        <div className="hidden md:block">
          <div className="rounded-lg border bg-neumorphic-light overflow-hidden">
            <Table className="bg-lunar-surface">
              <TableHeader>
                <TableRow className="bg-stone-200">
                  <TableHead className="font-medium">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 font-medium text-xs hover:bg-transparent"
                      onClick={() => handleSort('nome')}
                    >
                      NOME {getSortIcon('nome')}
                    </Button>
                  </TableHead>
                  <TableHead className="font-medium">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 font-medium text-xs hover:bg-transparent"
                      onClick={() => handleSort('email')}
                    >
                      E-MAIL {getSortIcon('email')}
                    </Button>
                  </TableHead>
                  <TableHead className="font-medium">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 font-medium text-xs hover:bg-transparent"
                      onClick={() => handleSort('telefone')}
                    >
                      TELEFONE {getSortIcon('telefone')}
                    </Button>
                  </TableHead>
                  <TableHead className="font-medium text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 font-medium text-xs hover:bg-transparent"
                      onClick={() => handleSort('sessoes')}
                    >
                      SESSÕES {getSortIcon('sessoes')}
                    </Button>
                  </TableHead>
                  <TableHead className="font-medium text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 font-medium text-xs hover:bg-transparent"
                      onClick={() => handleSort('totalFaturado')}
                    >
                      TOTAL FATURADO {getSortIcon('totalFaturado')}
                    </Button>
                  </TableHead>
                  <TableHead className="font-medium text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 font-medium text-xs hover:bg-transparent"
                      onClick={() => handleSort('totalPago')}
                    >
                      TOTAL PAGO {getSortIcon('totalPago')}
                    </Button>
                  </TableHead>
                  <TableHead className="font-medium text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 font-medium text-xs hover:bg-transparent"
                      onClick={() => handleSort('aReceber')}
                    >
                      A RECEBER {getSortIcon('aReceber')}
                    </Button>
                  </TableHead>
                  <TableHead className="font-medium text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 font-medium text-xs hover:bg-transparent"
                      onClick={() => handleSort('ultimaSessao')}
                    >
                      ÚLTIMA SESSÃO {getSortIcon('ultimaSessao')}
                    </Button>
                  </TableHead>
                  <TableHead className="font-medium text-center">AÇÕES</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientesFiltradosEOrdenados.map(cliente => (
                  <TableRow key={cliente.id} className="hover:bg-stone-50">
                    <TableCell className="font-medium">
                      <Link 
                        to={`/clientes/${cliente.id}`}
                        className="text-primary hover:text-primary/80 underline-offset-4 hover:underline"
                      >
                        {cliente.nome}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{cliente.email}</TableCell>
                    <TableCell className="text-sm">{cliente.telefone}</TableCell>
                    <TableCell className="text-center font-medium">
                      <span className={cliente.sessoes > 0 ? "text-primary" : "text-muted-foreground"}>
                        {cliente.sessoes}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <span className={cliente.totalFaturado > 0 ? "text-green-600" : "text-muted-foreground"}>
                        {formatCurrency(cliente.totalFaturado)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <span className={cliente.totalPago > 0 ? "text-blue-600" : "text-muted-foreground"}>
                        {formatCurrency(cliente.totalPago)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <span className={cliente.aReceber > 0 ? "text-orange-600" : "text-muted-foreground"}>
                        {formatCurrency(cliente.aReceber)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      <span className={cliente.ultimaSessao ? "text-foreground" : "text-muted-foreground"}>
                        {formatDate(cliente.ultimaSessao)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEditClient(cliente)} className="h-8 w-8 p-0">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteClient(cliente.id)} className="h-8 w-8 p-0 text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Visualização Mobile - Cards */}
        <div className="md:hidden grid grid-cols-1 gap-4">
          {clientesFiltradosEOrdenados.map(cliente => (
            <Card key={cliente.id} className="overflow-hidden bg-neumorphic-light bg-lunar-surface">
              <div className="p-4 flex items-center justify-between border-b bg-neumorphic-light bg-lunar-border">
                <div>
                  <h3 className="font-medium">
                    <Link 
                      to={`/clientes/${cliente.id}`}
                      className="text-primary hover:text-primary/80 underline-offset-4 hover:underline"
                    >
                      {cliente.nome}
                    </Link>
                  </h3>
                  <div className="flex gap-4 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {cliente.sessoes} sessões
                    </span>
                    <span className="text-xs text-green-600">
                      {formatCurrency(cliente.totalFaturado)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleEditClient(cliente)} className="h-8 w-8 p-0">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteClient(cliente.id)} className="h-8 w-8 p-0 text-red-600 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="p-4 space-y-3 bg-neumorphic-light bg-lunar-surface">
                <div className="flex items-start">
                  <Phone className="h-4 w-4 text-muted-foreground mt-0.5 mr-2" />
                  <span className="text-sm">{cliente.telefone}</span>
                </div>
                
                <div className="flex items-start">
                  <Mail className="h-4 w-4 text-muted-foreground mt-0.5 mr-2" />
                  <span className="text-sm">{cliente.email}</span>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Pago</p>
                    <p className="text-sm font-medium text-blue-600">{formatCurrency(cliente.totalPago)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">A Receber</p>
                    <p className="text-sm font-medium text-orange-600">{formatCurrency(cliente.aReceber)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Última Sessão</p>
                    <p className="text-sm font-medium">{formatDate(cliente.ultimaSessao)}</p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
        
        {clientesFiltradosEOrdenados.length === 0 && (
          <div className="flex flex-col items-center justify-center p-8 border rounded-md">
            <User className="h-12 w-12 text-muted-foreground mb-2" />
            <h3 className="text-lg font-medium">Nenhum cliente encontrado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {filtro ? 'Não encontramos clientes com os critérios de busca informados.' : 'Adicione seus primeiros clientes para começar.'}
            </p>
            {filtro ? (
              <Button onClick={() => setFiltro('')} variant="outline">
                Limpar filtro
              </Button>
            ) : (
              <Button onClick={handleAddClient} className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Adicionar Cliente
              </Button>
            )}
          </div>
        )}

        {/* Modal do Formulário de Cliente */}
        <Dialog open={showClientForm} onOpenChange={setShowClientForm}>
          <DialogContent className="sm:max-w-[500px] bg-neumorphic-light bg-lunar-bg">
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
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    nome: e.target.value
                  }))} 
                  placeholder="Nome completo" 
                />
              </div>
              
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={formData.email} 
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    email: e.target.value
                  }))} 
                  placeholder="email@exemplo.com" 
                />
              </div>
              
              <div>
                <Label htmlFor="telefone">Telefone *</Label>
                <Input 
                  id="telefone" 
                  value={formData.telefone} 
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    telefone: e.target.value
                  }))} 
                  placeholder="+55 (DDD) 00000-0000" 
                />
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
      </div>
    </ScrollArea>
  );
}