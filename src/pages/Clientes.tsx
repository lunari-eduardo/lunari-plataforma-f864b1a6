import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useClienteRegistry } from '@/hooks/useClienteRegistry';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, TrendingUp, DollarSign, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ClientForm from '@/components/crm/ClientForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function Clientes() {
  const { clientes, loading, syncData, getStats } = useClienteRegistry();
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewClientDialogOpen, setIsNewClientDialogOpen] = useState(false);

  // Filtrar clientes por termo de busca
  const filteredClientes = clientes.filter(clienteData => {
    if (!searchTerm.trim()) return true;
    
    const term = searchTerm.toLowerCase();
    const cliente = clienteData.cliente;
    return cliente.nome.toLowerCase().includes(term) ||
           cliente.email.toLowerCase().includes(term) ||
           cliente.telefone.includes(term);
  });

  // Estatísticas gerais do registry
  const stats = getStats();

  const handleClientCreated = () => {
    setIsNewClientDialogOpen(false);
    syncData(); // Sincronizar dados após criação
    toast.success('Cliente criado com sucesso!');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CRM - Clientes</h1>
          <p className="text-muted-foreground">
            Dashboard com métricas em tempo real do workflow
          </p>
        </div>
        <Dialog open={isNewClientDialogOpen} onOpenChange={setIsNewClientDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Users className="h-4 w-4 mr-2" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Cliente</DialogTitle>
            </DialogHeader>
            <ClientForm 
              onSave={(clientData) => {
                // Usar AppContext para adicionar cliente
                // Para simplificar, vou usar localStorage direto
                const clientes = JSON.parse(localStorage.getItem('lunari_clients') || '[]');
                const novoCliente = {
                  ...clientData,
                  id: `cliente-${Date.now()}`
                };
                clientes.push(novoCliente);
                localStorage.setItem('lunari_clients', JSON.stringify(clientes));
                handleClientCreated();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Estatísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClientes}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Faturado</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalFaturamento)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pago</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalPago)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A Receber</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalAReceber)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Busca */}
      <div className="max-w-sm">
        <Input
          placeholder="Buscar clientes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Tabela de Clientes */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="text-center">Sessões</TableHead>
                  <TableHead className="text-right">Total Faturado</TableHead>
                  <TableHead className="text-right">Total Pago</TableHead>
                  <TableHead className="text-right">A Receber</TableHead>
                  <TableHead className="text-center">Última Sessão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClientes.map((clienteData) => (
                  <TableRow key={clienteData.cliente.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {clienteData.cliente.nome.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{clienteData.cliente.nome}</div>
                          <div className="text-sm text-muted-foreground">{clienteData.cliente.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{clienteData.cliente.telefone}</TableCell>
                    <TableCell className="text-center">{clienteData.metricas.totalSessoes}</TableCell>
                    <TableCell className="text-right">{formatCurrency(clienteData.metricas.totalFaturado)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(clienteData.metricas.totalPago)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(clienteData.metricas.aReceber)}</TableCell>
                    <TableCell className="text-center">{clienteData.metricas.ultimaSessao || 'Nunca'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {filteredClientes.length === 0 && (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum cliente encontrado</h3>
              <p className="text-muted-foreground">
                {searchTerm ? 'Tente ajustar os filtros de busca' : 'Comece adicionando seu primeiro cliente'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}