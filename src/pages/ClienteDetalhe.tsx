import { useState, useContext, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppContext } from '@/contexts/AppContext';
import { useUnifiedWorkflowData } from '@/hooks/useUnifiedWorkflowData';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { ArrowLeft, User, History, Save, Edit3 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from '@/utils/financialUtils';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { toast } from 'sonner';

export default function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clientes, orcamentos, atualizarCliente } = useContext(AppContext);
  const { unifiedWorkflowData } = useUnifiedWorkflowData();
  
  // Encontrar o cliente pelo ID
  const cliente = useMemo(() => {
    return clientes.find(c => c.id === id);
  }, [clientes, id]);

  // Estados para edição
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    nome: cliente?.nome || '',
    email: cliente?.email || '',
    telefone: cliente?.telefone || '',
    endereco: cliente?.endereco || '',
    observacoes: cliente?.observacoes || ''
  });

  // Buscar histórico do cliente (workflow + orçamentos) usando dados unificados
  const clienteHistorico = useMemo(() => {
    if (!cliente) return [];

    console.log('🔍 Buscando histórico para cliente:', {
      clienteId: cliente.id,
      clienteNome: cliente.nome,
      totalUnifiedWorkflowData: unifiedWorkflowData.length
    });

    // Workflow items relacionados ao cliente (MESMO FILTRO DO useClientMetrics)
    const workflowDoCliente = unifiedWorkflowData
      .filter(item => {
        const matchByClienteId = item.clienteId === cliente.id;
        const matchByName = item.nome?.toLowerCase().trim() === cliente.nome?.toLowerCase().trim();
        return matchByClienteId || matchByName;
      })
      .map(item => ({
        id: item.id,
        tipo: 'workflow' as const,
        data: item.data,
        descricao: item.descricao || item.pacote,
        valor: item.total,
        status: item.status,
        detalhes: {
          pacote: item.pacote,
          categoria: item.categoria,
          valorPago: item.valorPago,
          restante: item.restante
        }
      }));

    // Orçamentos relacionados ao cliente
    const orcamentosDoCliente = orcamentos
      .filter(orc => {
        // Comparar com nome do cliente se não houver clienteId direto
        const nomeOrcamento = typeof orc.cliente === 'string' ? orc.cliente : orc.cliente?.nome;
        return nomeOrcamento?.toLowerCase().trim() === cliente.nome?.toLowerCase().trim();
      })
      .map(orc => ({
        id: orc.id,
        tipo: 'orcamento' as const,
        data: orc.data,
        descricao: `Orçamento - ${orc.categoria}`,
        valor: orc.valorTotal || orc.valorFinal || 0,
        status: orc.status,
        detalhes: {
          categoria: orc.categoria,
          origem: orc.origemCliente,
          observacoes: orc.detalhes
        }
      }));

    // Combinar e ordenar por data (mais recente primeiro)
    const historicoCombinado = [...workflowDoCliente, ...orcamentosDoCliente]
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    return historicoCombinado;
  }, [cliente, unifiedWorkflowData, orcamentos]);

  // Calcular métricas do cliente usando dados unificados
  const metricas = useMemo(() => {
    const workflowDoCliente = unifiedWorkflowData.filter(item => {
      const matchByClienteId = item.clienteId === cliente?.id;
      const matchByName = item.nome?.toLowerCase().trim() === cliente?.nome?.toLowerCase().trim();
      return matchByClienteId || matchByName;
    });

    const totalSessoes = workflowDoCliente.length;
    const totalFaturado = workflowDoCliente.reduce((acc, item) => acc + (item.total || 0), 0);
    const totalPago = workflowDoCliente.reduce((acc, item) => acc + (item.valorPago || 0), 0);
    const aReceber = totalFaturado - totalPago;

    return {
      totalSessoes,
      totalFaturado,
      totalPago,
      aReceber
    };
  }, [cliente, unifiedWorkflowData]);

  if (!cliente) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <User className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Cliente não encontrado</h2>
        <p className="text-muted-foreground mb-4">O cliente solicitado não existe ou foi removido.</p>
        <Button onClick={() => navigate('/clientes')} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Clientes
        </Button>
      </div>
    );
  }

  const handleSave = () => {
    if (!formData.nome || !formData.telefone) {
      toast.error('Nome e telefone são obrigatórios');
      return;
    }

    atualizarCliente(cliente.id, formData);
    setIsEditing(false);
    toast.success('Cliente atualizado com sucesso');
  };

  const handleCancel = () => {
    setFormData({
      nome: cliente.nome,
      email: cliente.email,
      telefone: cliente.telefone,
      endereco: cliente.endereco || '',
      observacoes: cliente.observacoes || ''
    });
    setIsEditing(false);
  };

  const formatDate = (dateString: string) => {
    // Usar formatDateForDisplay das dateUtils para evitar problemas de timezone
    return formatDateForDisplay(dateString);
  };

  const getStatusBadge = (status: string, tipo: string) => {
    if (tipo === 'workflow') {
      const colors = {
        'Agendado': 'bg-blue-100 text-blue-800',
        'Concluído': 'bg-green-100 text-green-800',
        'Cancelado': 'bg-red-100 text-red-800',
        'Em Andamento': 'bg-yellow-100 text-yellow-800'
      };
      return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
    } else {
      const colors = {
        'Pendente': 'bg-yellow-100 text-yellow-800',
        'Aprovado': 'bg-green-100 text-green-800',
        'Rejeitado': 'bg-red-100 text-red-800',
        'Revisão': 'bg-blue-100 text-blue-800'
      };
      return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <ScrollArea className="h-[calc(100vh-120px)]">
      <div className="space-y-6 pr-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button onClick={() => navigate('/clientes')} variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{cliente.nome}</h1>
              <p className="text-muted-foreground text-sm">
                Perfil completo do cliente e histórico de projetos
              </p>
            </div>
          </div>
          
          {/* Métricas Rápidas */}
          <div className="flex gap-4">
            <Card className="p-3">
              <div className="text-center">
                <div className="text-lg font-bold text-primary">{metricas.totalSessoes}</div>
                <div className="text-xs text-muted-foreground">Sessões</div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-center">
                <div className="text-lg font-bold text-green-600">{formatCurrency(metricas.totalFaturado)}</div>
                <div className="text-xs text-muted-foreground">Faturado</div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-center">
                <div className="text-lg font-bold text-orange-600">{formatCurrency(metricas.aReceber)}</div>
                <div className="text-xs text-muted-foreground">A Receber</div>
              </div>
            </Card>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="contacto" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="contacto" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Dados de Contacto
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico & Projetos
            </TabsTrigger>
          </TabsList>

          {/* Aba 1: Dados de Contacto */}
          <TabsContent value="contacto" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Informações de Contacto</CardTitle>
                  <CardDescription>
                    Gerencie os dados básicos do cliente
                  </CardDescription>
                </div>
                {!isEditing ? (
                  <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
                    <Edit3 className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button onClick={handleSave} size="sm">
                      <Save className="h-4 w-4 mr-2" />
                      Salvar
                    </Button>
                    <Button onClick={handleCancel} variant="outline" size="sm">
                      Cancelar
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nome">Nome *</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                      disabled={!isEditing}
                      placeholder="Nome completo"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="telefone">Telefone *</Label>
                    <Input
                      id="telefone"
                      value={formData.telefone}
                      onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
                      disabled={!isEditing}
                      placeholder="+55 (DDD) 00000-0000"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      disabled={!isEditing}
                      placeholder="email@exemplo.com"
                    />
                  </div>

                  <div>
                    <Label htmlFor="endereco">Endereço</Label>
                    <Input
                      id="endereco"
                      value={formData.endereco}
                      onChange={(e) => setFormData(prev => ({ ...prev, endereco: e.target.value }))}
                      disabled={!isEditing}
                      placeholder="Endereço completo"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    value={formData.observacoes}
                    onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                    disabled={!isEditing}
                    placeholder="Observações sobre o cliente..."
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba 2: Histórico & Projetos */}
          <TabsContent value="historico" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Histórico Completo</CardTitle>
                <CardDescription>
                  Todos os orçamentos e trabalhos realizados para este cliente
                </CardDescription>
              </CardHeader>
              <CardContent>
                {clienteHistorico.length === 0 ? (
                  <div className="text-center py-8">
                    <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Nenhum histórico encontrado</h3>
                    <p className="text-muted-foreground">
                      Este cliente ainda não possui orçamentos ou trabalhos registrados.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clienteHistorico.map((item) => (
                          <TableRow key={`${item.tipo}-${item.id}`}>
                            <TableCell className="font-medium">
                              {formatDate(item.data)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {item.tipo === 'workflow' ? 'Trabalho' : 'Orçamento'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{item.descricao}</div>
                                {item.tipo === 'workflow' && item.detalhes.categoria && (
                                  <div className="text-sm text-muted-foreground">
                                    {item.detalhes.categoria}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusBadge(item.status, item.tipo)}>
                                {item.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="font-medium">{formatCurrency(item.valor)}</div>
                              {item.tipo === 'workflow' && (
                                <div className="text-sm text-muted-foreground">
                                  Pago: {formatCurrency(item.detalhes.valorPago || 0)}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}