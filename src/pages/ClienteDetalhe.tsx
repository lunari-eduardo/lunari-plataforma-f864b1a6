import { useState, useContext, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppContext } from '@/contexts/AppContext';
import { useUnifiedWorkflowData } from '@/hooks/useUnifiedWorkflowData';
import { useFileUpload } from '@/hooks/useFileUpload';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { ArrowLeft, User, History, Save, Edit3, Upload, FileText, TrendingUp, Calendar } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { FileUploadZone } from '@/components/shared/FileUploadZone';
import { ClientAnalytics } from '@/components/crm/ClientAnalytics';
import { formatCurrency } from '@/utils/financialUtils';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { toast } from 'sonner';

export default function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clientes, orcamentos, atualizarCliente } = useContext(AppContext);
  const { unifiedWorkflowData } = useUnifiedWorkflowData();
  const { getFilesByClient, loadFiles } = useFileUpload();
  
  // Carregar arquivos ao montar componente
  useEffect(() => {
    loadFiles();
  }, []);

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
      });

    // Orçamentos relacionados ao cliente
    const orcamentosDoCliente = orcamentos
      .filter(orc => {
        // Comparar com nome do cliente se não houver clienteId direto
        const nomeOrcamento = typeof orc.cliente === 'string' ? orc.cliente : orc.cliente?.nome;
        return nomeOrcamento?.toLowerCase().trim() === cliente.nome?.toLowerCase().trim();
      });

    // LÓGICA DE UNIFICAÇÃO: Merge de orçamentos com workflow items relacionados
    const projetosUnificados = new Map();
    const workflowProcessados = new Set<string>();

    // 1. Processar workflow items que têm origem em orçamentos
    workflowDoCliente.forEach(workflowItem => {
      // Detectar se o workflow item tem origem em orçamento (ID padrão: orcamento-{orcamentoId})
      const isFromOrcamento = workflowItem.id.startsWith('orcamento-');
      
      if (isFromOrcamento) {
        const orcamentoId = workflowItem.id.replace('orcamento-', '');
        const orcamentoOriginal = orcamentosDoCliente.find(orc => orc.id === orcamentoId);
        
        if (orcamentoOriginal) {
          // PROJETO UNIFICADO: Priorizar dados do workflow + metadados do orçamento
          projetosUnificados.set(workflowItem.id, {
            id: workflowItem.id,
            tipo: 'projeto' as const, // Tipo especial para projetos unificados
            data: workflowItem.data, // Data do trabalho (mais recente)
            descricao: workflowItem.descricao || workflowItem.pacote,
            valor: workflowItem.total, // Valor atual do trabalho
            status: workflowItem.status, // Status atual do trabalho
            detalhes: {
              pacote: workflowItem.pacote,
              categoria: workflowItem.categoria,
              valorPago: workflowItem.valorPago,
              restante: workflowItem.restante,
              // Metadados do orçamento original
              dataOrcamento: orcamentoOriginal.data,
              origemCliente: orcamentoOriginal.origemCliente,
              observacoesOrcamento: orcamentoOriginal.detalhes
            }
          });
          
          workflowProcessados.add(workflowItem.id);
          console.log('🔗 Projeto unificado criado:', workflowItem.id, '← orçamento:', orcamentoId);
        }
      }
    });

    // 2. Adicionar workflow items que NÃO têm origem em orçamentos
    workflowDoCliente.forEach(workflowItem => {
      if (!workflowProcessados.has(workflowItem.id)) {
        projetosUnificados.set(workflowItem.id, {
          id: workflowItem.id,
          tipo: 'workflow' as const,
          data: workflowItem.data,
          descricao: workflowItem.descricao || workflowItem.pacote,
          valor: workflowItem.total,
          status: workflowItem.status,
          detalhes: {
            pacote: workflowItem.pacote,
            categoria: workflowItem.categoria,
            valorPago: workflowItem.valorPago,
            restante: workflowItem.restante
          }
        });
      }
    });

    // 3. Adicionar orçamentos que NÃO se tornaram trabalhos
    orcamentosDoCliente.forEach(orcamento => {
      const jaVirouWorkflowItem = workflowDoCliente.some(w => w.id === `orcamento-${orcamento.id}`);
      
      if (!jaVirouWorkflowItem) {
        projetosUnificados.set(`orc-${orcamento.id}`, {
          id: orcamento.id,
          tipo: 'orcamento' as const,
          data: orcamento.data,
          descricao: `Orçamento - ${orcamento.categoria}`,
          valor: orcamento.valorTotal || orcamento.valorFinal || 0,
          status: orcamento.status,
          detalhes: {
            categoria: orcamento.categoria,
            origem: orcamento.origemCliente,
            observacoes: orcamento.detalhes
          }
        });
      }
    });

    // Combinar e ordenar por data (mais recente primeiro)
    const historicoCombinado = Array.from(projetosUnificados.values())
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    console.log('✅ Histórico unificado:', {
      total: historicoCombinado.length,
      projetos: historicoCombinado.filter(h => h.tipo === 'projeto').length,
      workflows: historicoCombinado.filter(h => h.tipo === 'workflow').length,
      orcamentos: historicoCombinado.filter(h => h.tipo === 'orcamento').length
    });

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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="contacto" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Contacto
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="documentos" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documentos
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Analytics
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
                           <Badge variant="outline" className={
                                  item.tipo === 'projeto' ? 'border-primary text-primary' :
                                  item.tipo === 'workflow' ? 'border-blue-500 text-blue-600' : 
                                  'border-orange-500 text-orange-600'
                                }>
                                  {item.tipo === 'projeto' ? '🔗 Projeto' : 
                                   item.tipo === 'workflow' ? '⚡ Trabalho' : '📋 Orçamento'}
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

          {/* Aba 3: Documentos */}
          <TabsContent value="documentos" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Documentos do Cliente
                </CardTitle>
                <CardDescription>
                  Gerencie todos os documentos relacionados a este cliente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileUploadZone
                  clienteId={cliente?.id}
                  description="Documento do cliente"
                  showExisting={true}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba 4: Analytics */}
          <TabsContent value="analytics" className="space-y-6">
            <ClientAnalytics 
              metrics={{
                id: cliente?.id || '',
                nome: cliente?.nome || '',
                email: cliente?.email || '',
                telefone: cliente?.telefone || '',
                sessoes: metricas.totalSessoes,
                totalFaturado: metricas.totalFaturado,
                totalPago: metricas.totalPago,
                aReceber: metricas.aReceber,
                ultimaSessao: clienteHistorico.length > 0 
                  ? new Date(clienteHistorico[0].data) 
                  : null
              }}
              files={getFilesByClient(cliente?.id || '')}
              historico={clienteHistorico}
            />
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}