import { useState, useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { Cliente } from '@/types/orcamentos';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, UserPlus, User, Phone, Mail, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, DollarSign, Calendar, Activity } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from 'sonner';
import { formatCurrency } from '@/utils/financialUtils';
import { createTestClient, createTestWorkflowItem } from '@/utils/testData';

// Interface para cliente enriquecido com métricas calculadas
interface ClienteComMetricas extends Cliente {
  metricas: {
    sessoes: number;
    totalFaturado: number;
    totalPago: number;
    aReceber: number;
    ultimaSessao: string | null;
  };
}

type SortConfig = {
  key: keyof ClienteComMetricas['metricas'] | 'nome' | 'email' | 'telefone';
  direction: 'asc' | 'desc' | null;
};

function ClientesContent() {
  const context = useAppContext();
  
  const [filtro, setFiltro] = useState('');
  const [showClientForm, setShowClientForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Cliente | null>(null);
  const [formData, setFormData] = useState({ nome: '', email: '', telefone: '' });
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'nome', direction: null });

  if (!context) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <div className="p-6 text-center">
            <User className="mx-auto w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Carregando dados...</h3>
            <div className="space-y-3">
              <div className="h-2 bg-muted rounded animate-pulse" />
              <div className="h-2 bg-muted rounded animate-pulse w-3/4" />
              <div className="h-2 bg-muted rounded animate-pulse w-1/2" />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const { clientes, allWorkflowItems, adicionarCliente, atualizarCliente, removerCliente } = context;
  
  // LÓGICA SIMPLIFICADA: CRM busca dados APENAS do workflow
  const clientesComMetricas: ClienteComMetricas[] = useMemo(() => {
    console.log('🔄 CRM - DADOS APENAS DO WORKFLOW:', {
      totalClientes: clientes?.length || 0,
      totalWorkflowItems: allWorkflowItems?.length || 0
    });

    if (!clientes || clientes.length === 0) {
      return [];
    }

    return clientes.map(cliente => {
      // Filtrar itens do workflow para este cliente
      const workflowDoCliente = allWorkflowItems?.filter(item => {
        // Match por clienteId (prioridade)
        if (item.clienteId === cliente.id) return true;
        
        // Fallback por nome
        if (item.nome && cliente.nome) {
          return item.nome.toLowerCase().trim() === cliente.nome.toLowerCase().trim();
        }
        
        // Fallback por telefone
        if (item.whatsapp && cliente.telefone) {
          const telefoneItem = item.whatsapp.replace(/\D/g, '');
          const telefoneCliente = cliente.telefone.replace(/\D/g, '');
          return telefoneItem === telefoneCliente && telefoneItem.length >= 10;
        }
        
        return false;
      }) || [];

      // Calcular métricas diretamente do workflow
      const sessoes = workflowDoCliente.length;
      const totalFaturado = workflowDoCliente.reduce((soma, item) => soma + (item.total || 0), 0);
      const totalPago = workflowDoCliente.reduce((soma, item) => soma + (item.valorPago || 0), 0);
      const aReceber = workflowDoCliente.reduce((soma, item) => soma + (item.restante || 0), 0);
      
      // Última sessão
      let ultimaSessao: string | null = null;
      if (workflowDoCliente.length > 0) {
        const datasValidas = workflowDoCliente
          .map(item => {
            if (item.dataOriginal instanceof Date) return item.dataOriginal;
            const [day, month, year] = item.data.split('/');
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          })
          .filter(date => !isNaN(date.getTime()))
          .sort((a, b) => b.getTime() - a.getTime());
        
        if (datasValidas.length > 0) {
          ultimaSessao = datasValidas[0].toLocaleDateString('pt-BR');
        }
      }

      return {
        ...cliente,
        metricas: { sessoes, totalFaturado, totalPago, aReceber, ultimaSessao }
      };
    });
  }, [clientes, allWorkflowItems]);

  const clientesFiltradosEOrdenados = useMemo(() => {
    let resultado = filtro 
      ? clientesComMetricas.filter(cliente => 
          cliente.nome.toLowerCase().includes(filtro.toLowerCase()) || 
          cliente.email.toLowerCase().includes(filtro.toLowerCase()) || 
          cliente.telefone.includes(filtro)
        ) 
      : clientesComMetricas;

    if (sortConfig.direction) {
      resultado.sort((a, b) => {
        let valorA: any, valorB: any;

        if (sortConfig.key === 'nome' || sortConfig.key === 'email' || sortConfig.key === 'telefone') {
          valorA = a[sortConfig.key].toLowerCase();
          valorB = b[sortConfig.key].toLowerCase();
        } else {
          valorA = a.metricas[sortConfig.key] || 0;
          valorB = b.metricas[sortConfig.key] || 0;
          
          if (sortConfig.key === 'ultimaSessao') {
            valorA = a.metricas.ultimaSessao ? new Date(a.metricas.ultimaSessao.split('/').reverse().join('-')).getTime() : 0;
            valorB = b.metricas.ultimaSessao ? new Date(b.metricas.ultimaSessao.split('/').reverse().join('-')).getTime() : 0;
          }
        }

        if (valorA < valorB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valorA > valorB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return resultado;
  }, [clientesComMetricas, filtro, sortConfig]);

  const handleSort = (key: SortConfig['key']) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key 
        ? (prev.direction === 'asc' ? 'desc' : prev.direction === 'desc' ? null : 'asc')
        : 'asc'
    }));
  };

  const renderSortIcon = (key: SortConfig['key']) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    if (sortConfig.direction === 'asc') return <ArrowUp className="h-3 w-3 ml-1" />;
    if (sortConfig.direction === 'desc') return <ArrowDown className="h-3 w-3 ml-1" />;
    return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
  };

  const handleAddClient = () => {
    setEditingClient(null);
    setFormData({ nome: '', email: '', telefone: '' });
    setShowClientForm(true);
  };

  // TESTE: Criar dados de exemplo para testar a integração
  const handleCreateTestData = () => {
    const testClient = createTestClient();
    const testWorkflow = createTestWorkflowItem(testClient.id);
    
    // Adicionar cliente
    adicionarCliente(testClient);
    
    // Simular adição direta ao workflow (para teste)
    const currentWorkflow = JSON.parse(localStorage.getItem('lunari_workflow_items') || '[]');
    const updatedWorkflow = [...currentWorkflow, testWorkflow];
    localStorage.setItem('lunari_workflow_items', JSON.stringify(updatedWorkflow));
    
    toast.success('Dados de teste criados! Recarregue a página para ver as métricas.');
  };
  
  const handleEditClient = (client: Cliente) => {
    setEditingClient(client);
    setFormData({ nome: client.nome, email: client.email, telefone: client.telefone });
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

  return (
    <ScrollArea className="h-[calc(100vh-120px)]">
      <div className="space-y-6 pr-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
            <p className="text-muted-foreground text-sm">
              Dashboard de CRM com métricas financeiras e operacionais em tempo real
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={handleCreateTestData} variant="outline" size="sm">
              Criar Dados de Teste
            </Button>
            <Button onClick={handleAddClient} className="bg-primary">
              <UserPlus className="h-4 w-4 mr-2" />
              Novo Cliente
            </Button>
          </div>
        </div>
        
        <div className="flex gap-2 max-w-lg">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar clientes" 
              className="pl-8" 
              value={filtro} 
              onChange={e => setFiltro(e.target.value)} 
            />
          </div>
        </div>

        <div className="hidden md:block">
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold cursor-pointer hover:bg-muted transition-colors" onClick={() => handleSort('nome')}>
                    <div className="flex items-center">NOME {renderSortIcon('nome')}</div>
                  </TableHead>
                  <TableHead className="font-semibold cursor-pointer hover:bg-muted transition-colors" onClick={() => handleSort('email')}>
                    <div className="flex items-center">E-MAIL {renderSortIcon('email')}</div>
                  </TableHead>
                  <TableHead className="font-semibold cursor-pointer hover:bg-muted transition-colors" onClick={() => handleSort('telefone')}>
                    <div className="flex items-center">TELEFONE {renderSortIcon('telefone')}</div>
                  </TableHead>
                  <TableHead className="font-semibold cursor-pointer hover:bg-muted transition-colors text-center" onClick={() => handleSort('sessoes')}>
                    <div className="flex items-center justify-center"><Activity className="h-4 w-4 mr-1" />SESSÕES {renderSortIcon('sessoes')}</div>
                  </TableHead>
                  <TableHead className="font-semibold cursor-pointer hover:bg-muted transition-colors text-right" onClick={() => handleSort('totalFaturado')}>
                    <div className="flex items-center justify-end"><DollarSign className="h-4 w-4 mr-1" />TOTAL FATURADO {renderSortIcon('totalFaturado')}</div>
                  </TableHead>
                  <TableHead className="font-semibold cursor-pointer hover:bg-muted transition-colors text-right" onClick={() => handleSort('totalPago')}>
                    <div className="flex items-center justify-end"><DollarSign className="h-4 w-4 mr-1" />TOTAL PAGO {renderSortIcon('totalPago')}</div>
                  </TableHead>
                  <TableHead className="font-semibold cursor-pointer hover:bg-muted transition-colors text-right" onClick={() => handleSort('aReceber')}>
                    <div className="flex items-center justify-end"><DollarSign className="h-4 w-4 mr-1" />A RECEBER {renderSortIcon('aReceber')}</div>
                  </TableHead>
                  <TableHead className="font-semibold cursor-pointer hover:bg-muted transition-colors text-center" onClick={() => handleSort('ultimaSessao')}>
                    <div className="flex items-center justify-center"><Calendar className="h-4 w-4 mr-1" />ÚLTIMA SESSÃO {renderSortIcon('ultimaSessao')}</div>
                  </TableHead>
                  <TableHead className="font-semibold text-center">AÇÕES</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientesFiltradosEOrdenados.map(cliente => (
                  <TableRow key={cliente.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{cliente.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{cliente.email}</TableCell>
                    <TableCell>{cliente.telefone}</TableCell>
                    <TableCell className="text-center font-semibold">{cliente.metricas.sessoes}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">{formatCurrency(cliente.metricas.totalFaturado)}</TableCell>
                    <TableCell className="text-right font-semibold text-emerald-600">{formatCurrency(cliente.metricas.totalPago)}</TableCell>
                    <TableCell className="text-right font-semibold text-amber-600">{formatCurrency(cliente.metricas.aReceber)}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{cliente.metricas.ultimaSessao || 'Nunca'}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEditClient(cliente)} className="h-8 w-8 p-0">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteClient(cliente.id)} className="h-8 w-8 p-0 text-destructive">
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

        {clientesFiltradosEOrdenados.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 border rounded-lg">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum cliente encontrado</h3>
            <p className="text-muted-foreground text-center mb-4">
              {filtro ? 'Não encontramos clientes com os critérios de busca.' : 'Comece adicionando seu primeiro cliente.'}
            </p>
            <Button onClick={filtro ? () => setFiltro('') : handleAddClient} variant="outline">
              {filtro ? 'Limpar filtro' : 'Adicionar Cliente'}
            </Button>
          </div>
        )}

        <Dialog open={showClientForm} onOpenChange={setShowClientForm}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingClient ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome *</Label>
                <Input 
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Nome completo"
                />
              </div>
              
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input 
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                />
              </div>
              
              <div>
                <Label htmlFor="telefone">Telefone *</Label>
                <Input 
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
                  placeholder="+55 (DDD) 00000-0000"
                />
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowClientForm(false)}>Cancelar</Button>
                <Button onClick={handleSaveClient}>{editingClient ? 'Atualizar' : 'Adicionar'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ScrollArea>
  );
}

export default function Clientes() {
  return (
    <ErrorBoundary>
      <ClientesContent />
    </ErrorBoundary>
  );
}