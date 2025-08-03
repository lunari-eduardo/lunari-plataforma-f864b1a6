import { useState, useContext, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppContext } from '@/contexts/AppContext';
import { Cliente } from '@/types/orcamentos';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, UserPlus, User, Phone, Mail, Edit, Trash2, MessageCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from 'sonner';
import { useClientMetrics, ClientMetrics } from '@/hooks/useClientMetrics';
import { useWorkflowSync } from '@/hooks/useWorkflowSync';
import { migrateWorkflowClienteId } from '@/utils/migrateWorkflowClienteId';
import { formatCurrency } from '@/utils/financialUtils';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { abrirWhatsApp } from '@/utils/whatsappUtils';

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
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: ''
  });


  // Obter dados simples dos clientes
  const clientMetrics = useClientMetrics(clientes);

  // Filtrar clientes
  const clientesFiltrados = useMemo(() => {
    return clientMetrics.filter(cliente => {
      return cliente.nome.toLowerCase().includes(filtro.toLowerCase()) ||
             cliente.email.toLowerCase().includes(filtro.toLowerCase()) ||
             cliente.telefone.includes(filtro);
    });
  }, [clientMetrics, filtro]);

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

  const handleWhatsApp = (cliente: ClientMetrics) => {
    const telefone = cliente.telefone.replace(/\D/g, '');
    const mensagem = `Olá ${cliente.nome}! 😊\n\nComo você está? Espero que esteja tudo bem!\n\nEstou entrando em contato para...`;
    const mensagemCodificada = encodeURIComponent(mensagem);
    const link = `https://wa.me/55${telefone}?text=${mensagemCodificada}`;
    window.open(link, '_blank');
  };

  const limparFiltros = () => {
    setFiltro('');
  };

  return (
    <ScrollArea className="h-[calc(100vh-120px)]">
      <div className="space-y-6 pr-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Clientes</h1>
          <Button onClick={handleAddClient} className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Novo Cliente
          </Button>
        </div>
        
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar clientes..." 
              className="pl-8" 
              value={filtro} 
              onChange={e => setFiltro(e.target.value)} 
            />
          </div>

          <Button variant="outline" onClick={limparFiltros}>
            Limpar
          </Button>
        </div>

        {/* Grid de Clientes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clientesFiltrados.map(cliente => (
            <Card key={cliente.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                {/* Header do Card */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <Link 
                      to={`/clientes/${cliente.id}`}
                      className="text-lg font-semibold text-primary hover:text-primary/80 block"
                    >
                      {cliente.nome}
                    </Link>
                    <p className="text-sm text-muted-foreground">{cliente.email}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleWhatsApp(cliente)}
                      className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleEditClient(cliente)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleDeleteClient(cliente.id)}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Informações de Contato */}
                <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  <span>{cliente.telefone}</span>
                </div>

                {/* Email */}
                <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  <span className="truncate">{cliente.email || 'Sem email'}</span>
                </div>

                {/* Métricas Financeiras */}
                <div className="border-t pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sessões:</span>
                    <span className="font-medium">{cliente.sessoes}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-medium text-primary">
                      R$ {cliente.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pago:</span>
                    <span className="font-medium text-green-600">
                      R$ {cliente.pago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">A Receber:</span>
                    <span className="font-medium text-orange-600">
                      R$ {cliente.restante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* Empty State */}
        {clientesFiltrados.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum cliente encontrado</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center">
              {filtro 
                ? 'Não encontramos clientes com os critérios de busca informados.' 
                : 'Adicione seus primeiros clientes para começar.'}
            </p>
            {filtro ? (
              <Button onClick={limparFiltros} variant="outline">
                Limpar filtros
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