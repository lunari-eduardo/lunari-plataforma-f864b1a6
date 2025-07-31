import { useState, useContext } from 'react';
import { AppContext } from '@/contexts/AppContext';
import { Cliente } from '@/types/orcamentos';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, UserPlus, User, Phone, Mail, Edit, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from 'sonner';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';

export default function Clientes() {
  const {
    clientes,
    adicionarCliente,
    atualizarCliente,
    removerCliente
  } = useContext(AppContext);
  
  const { isAuthenticated, userInfo, authenticate, disconnect } = useGoogleAuth();
  
  const [filtro, setFiltro] = useState('');
  const [showClientForm, setShowClientForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Cliente | null>(null);
  const [formData, setFormData] = useState({ nome: '', email: '', telefone: '' });

  // Filtrar clientes baseado na busca
  const clientesFiltrados = filtro ? (clientes || []).filter(cliente => 
    cliente.nome.toLowerCase().includes(filtro.toLowerCase()) || 
    cliente.email.toLowerCase().includes(filtro.toLowerCase()) || 
    cliente.telefone.includes(filtro)
  ) : (clientes || []);

  const handleAddClient = () => {
    setEditingClient(null);
    setFormData({ nome: '', email: '', telefone: '' });
    setShowClientForm(true);
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
          <p className="text-muted-foreground text-xs">
            Gerencie todos os seus clientes e acompanhe informações de contato.
          </p>
        </div>
        
        <div className="flex gap-2">
          {!isAuthenticated ? (
            <Button 
              onClick={authenticate} 
              variant="secondary" 
              className="py-0 my-[8px]"
            >
              [G] Importar dos Contactos Google
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="secondary" className="py-0 my-[8px] cursor-default">
                [✓] Conectado ao Google
                {userInfo?.name && (
                  <span className="ml-1 text-xs opacity-70">({userInfo.name})</span>
                )}
              </Button>
              <Button 
                onClick={disconnect} 
                variant="outline" 
                size="sm"
                className="py-0 my-[8px]"
              >
                Desconectar
              </Button>
            </div>
          )}
          
          <Button onClick={handleAddClient} className="bg-neumorphic-dark text-slate-50 bg-lunar-accent py-0 my-[8px]">
            <UserPlus className="h-4 w-4 mr-1" />
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

      {/* Visualização Desktop - Tabela */}
      <div className="hidden md:block">
        <div className="rounded-lg border bg-neumorphic-light overflow-hidden">
          <Table className="bg-lunar-surface">
            <TableHeader>
              <TableRow className="bg-stone-200">
                <TableHead className="font-medium">NOME</TableHead>
                <TableHead className="font-medium">E-MAIL</TableHead>
                <TableHead className="font-medium">TELEFONE</TableHead>
                <TableHead className="font-medium text-center">AÇÕES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientesFiltrados.map(cliente => (
                <TableRow key={cliente.id} className="hover:bg-stone-50">
                  <TableCell className="font-medium">{cliente.nome}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{cliente.email}</TableCell>
                  <TableCell className="text-sm">{cliente.telefone}</TableCell>
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
        {clientesFiltrados.map(cliente => (
          <Card key={cliente.id} className="overflow-hidden bg-neumorphic-light bg-lunar-surface">
            <div className="p-4 flex items-center justify-between border-b bg-neumorphic-light bg-lunar-border">
              <div>
                <h3 className="font-medium">{cliente.nome}</h3>
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
            </div>
          </Card>
        ))}
      </div>
      
      {clientesFiltrados.length === 0 && (
        <div className="flex flex-col items-center justify-center p-8 border rounded-md">
          <User className="h-12 w-12 text-muted-foreground mb-2" />
          <h3 className="text-lg font-medium">Nenhum cliente encontrado</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Não encontramos clientes com os critérios de busca informados.
          </p>
          <Button onClick={() => setFiltro('')} variant="outline">
            Limpar filtro
          </Button>
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