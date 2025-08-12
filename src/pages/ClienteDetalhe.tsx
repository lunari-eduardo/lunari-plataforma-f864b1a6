import { useState, useContext, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppContext } from '@/contexts/AppContext';
import { useFileUpload } from '@/hooks/useFileUpload';
import { autoFixIfNeeded, getSimplifiedClientMetrics } from '@/utils/crmDataFix';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { ArrowLeft, User, History, Save, Edit3, Upload, FileText, TrendingUp, Calendar, MessageCircle, Mail, Plus, Trash } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { FileUploadZone } from '@/components/shared/FileUploadZone';
import { WorkflowHistoryTable } from '@/components/crm/WorkflowHistoryTable';
import { formatCurrency } from '@/utils/financialUtils';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { toast } from 'sonner';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { ORIGENS_PADRAO } from '@/utils/defaultOrigens';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
export default function ClienteDetalhe() {
  const {
    id
  } = useParams<{
    id: string;
  }>();
  const navigate = useNavigate();
  const {
    clientes,
    atualizarCliente
  } = useContext(AppContext);
  const {
    getFilesByClient,
    loadFiles
  } = useFileUpload();
  
  

  // Carregar arquivos e executar correção automática
  useEffect(() => {
    autoFixIfNeeded();
    loadFiles();
  }, []);

  // Encontrar o cliente pelo ID
  const cliente = useMemo(() => {
    return clientes.find(c => c.id === id);
  }, [clientes, id]);

  const origemInfo = useMemo(() => ORIGENS_PADRAO.find(o => o.id === cliente?.origem), [cliente]);
  const getInitials = (name?: string) => {
    if (!name) return '';
    const parts = name.trim().split(' ');
    const first = parts[0]?.[0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  };

  // Estados para edição
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    nome: cliente?.nome || '',
    email: cliente?.email || '',
    telefone: cliente?.telefone || '',
    endereco: cliente?.endereco || '',
    observacoes: cliente?.observacoes || '',
    origem: cliente?.origem || '',
    dataNascimento: cliente?.dataNascimento || '',
    conjuge: (cliente as any)?.conjuge || { nome: '', dataNascimento: '' },
    filhos: (((cliente as any)?.filhos) || []) as { id: string; nome?: string; dataNascimento?: string }[],
  });

  // Métricas simplificadas e precisas
  const metricas = useMemo(() => {
    if (!cliente) return {
      totalSessoes: 0,
      totalFaturado: 0,
      totalPago: 0,
      aReceber: 0
    };
    const clientMetrics = getSimplifiedClientMetrics([cliente]);
    const metrics = clientMetrics[0];
    if (!metrics) return {
      totalSessoes: 0,
      totalFaturado: 0,
      totalPago: 0,
      aReceber: 0
    };
    return {
      totalSessoes: metrics.totalSessoes,
      totalFaturado: metrics.totalFaturado,
      totalPago: metrics.totalPago,
      aReceber: metrics.aReceber
    };
  }, [cliente]);
  if (!cliente) {
    return <div className="flex flex-col items-center justify-center h-96">
        <User className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Cliente não encontrado</h2>
        <p className="text-muted-foreground mb-4">O cliente solicitado não existe ou foi removido.</p>
        <Button onClick={() => navigate('/clientes')} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Clientes
        </Button>
      </div>;
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
      observacoes: cliente.observacoes || '',
      origem: cliente.origem || '',
      dataNascimento: cliente.dataNascimento || '',
      conjuge: (cliente as any).conjuge || { nome: '', dataNascimento: '' },
      filhos: ((cliente as any).filhos || []) as { id: string; nome?: string; dataNascimento?: string }[],
    });
    setIsEditing(false);
  };
  const addFilho = () => {
    setFormData(prev => ({
      ...prev,
      filhos: ([...(prev.filhos || []), { id: `filho_${Date.now()}`, nome: '', dataNascimento: '' }])
    }));
  };
  const removeFilho = (id: string) => {
    setFormData(prev => ({
      ...prev,
      filhos: (prev.filhos || []).filter(f => f.id !== id)
    }));
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
  return <ScrollArea className="h-[calc(100vh-120px)]">
      <div className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button onClick={() => navigate('/clientes')} variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback>{getInitials(cliente.nome)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-bold text-base">{cliente.nome}</h1>
                  {origemInfo && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: origemInfo.cor }} />
                      {origemInfo.nome}
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-xs">Perfil completo do cliente</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              {cliente.telefone && (
                <Button asChild variant="outline" size="sm">
                  <a href={`https://wa.me/${cliente.telefone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-4 w-4 mr-1" />
                    WhatsApp
                  </a>
                </Button>
              )}
              {cliente.email && (
                <Button asChild variant="outline" size="sm">
                  <a href={`mailto:${cliente.email}`}>
                    <Mail className="h-4 w-4 mr-1" />
                    E-mail
                  </a>
                </Button>
              )}
            </div>

            {/* Métricas Rápidas */}
            <div className="flex gap-1 md:gap-2">
              <Card className="p-2 md:p-3">
                <div className="text-center">
                  <div className="text-sm md:text-lg font-bold text-primary">{metricas.totalSessoes}</div>
                  <div className="text-xs text-muted-foreground">Sessões</div>
                </div>
              </Card>
              <Card className="p-2 md:p-3">
                <div className="text-center">
                  <div className="text-sm md:text-lg font-bold text-green-600">{formatCurrency(metricas.totalFaturado)}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
              </Card>
              <Card className="p-2 md:p-3">
                <div className="text-center">
                  <div className="text-sm md:text-lg font-bold text-orange-600">{formatCurrency(metricas.aReceber)}</div>
                  <div className="text-xs text-muted-foreground">A Receber</div>
                </div>
              </Card>
            </div>
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
            <TabsTrigger value="financeiro" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Financeiro
            </TabsTrigger>
            <TabsTrigger value="documentos" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documentos
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
                {!isEditing ? <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
                    <Edit3 className="h-4 w-4 mr-2" />
                    Editar
                  </Button> : <div className="flex gap-2">
                    <Button onClick={handleSave} size="sm">
                      <Save className="h-4 w-4 mr-2" />
                      Salvar
                    </Button>
                    <Button onClick={handleCancel} variant="outline" size="sm">
                      Cancelar
                    </Button>
                  </div>}
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Seção: Informações Pessoais */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Informações Pessoais</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-1">
                      <Label htmlFor="nome">Nome *</Label>
                      <Input id="nome" value={formData.nome} onChange={e => setFormData(prev => ({ ...prev, nome: e.target.value }))} disabled={!isEditing} placeholder="Nome completo" />
                    </div>
                    <div>
                      <Label htmlFor="dataNascimento">Data de Nascimento</Label>
                      <Input id="dataNascimento" type="date" value={formData.dataNascimento} onChange={e => setFormData(prev => ({ ...prev, dataNascimento: e.target.value }))} disabled={!isEditing} />
                    </div>
                  </div>
                </div>

                {/* Seção: Contatos e Endereço */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Contatos e Endereço</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="telefone">Telefone *</Label>
                      <Input id="telefone" value={formData.telefone} onChange={e => setFormData(prev => ({ ...prev, telefone: e.target.value }))} disabled={!isEditing} placeholder="+55 (DDD) 00000-0000" />
                    </div>
                    <div>
                      <Label htmlFor="email">E-mail</Label>
                      <Input id="email" type="email" value={formData.email} onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))} disabled={!isEditing} placeholder="email@exemplo.com" />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="endereco">Endereço</Label>
                      <Input id="endereco" value={formData.endereco} onChange={e => setFormData(prev => ({ ...prev, endereco: e.target.value }))} disabled={!isEditing} placeholder="Endereço completo" />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="origem">Como conheceu?</Label>
                      {isEditing ? (
                        <Select value={formData.origem} onValueChange={(value) => setFormData(prev => ({ ...prev, origem: value }))}>
                          <SelectTrigger id="origem">
                            <SelectValue placeholder="Selecione a origem" />
                          </SelectTrigger>
                          <SelectContent>
                            {ORIGENS_PADRAO.map(origem => (
                              <SelectItem key={origem.id} value={origem.id}>
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: origem.cor }} />
                                  {origem.nome}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input id="origem" value={ORIGENS_PADRAO.find(o => o.id === formData.origem)?.nome || 'Não informado'} disabled placeholder="Origem não informada" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Seção: Observações */}
                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea id="observacoes" value={formData.observacoes} onChange={e => setFormData(prev => ({ ...prev, observacoes: e.target.value }))} disabled={!isEditing} placeholder="Observações sobre o cliente..." rows={4} />
                </div>

                {/* Seção: Relacionamentos */}
                <div className="space-y-3">
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="conjugeNome">Cônjuge - Nome</Label>
                      <Input id="conjugeNome" value={formData.conjuge?.nome || ''} onChange={e => setFormData(prev => ({ ...prev, conjuge: { ...(prev.conjuge || {}), nome: e.target.value } }))} disabled={!isEditing} placeholder="Nome do cônjuge" />
                    </div>
                    <div>
                      <Label htmlFor="conjugeNascimento">Cônjuge - Data de Nascimento</Label>
                      <Input id="conjugeNascimento" type="date" value={formData.conjuge?.dataNascimento || ''} onChange={e => setFormData(prev => ({ ...prev, conjuge: { ...(prev.conjuge || {}), dataNascimento: e.target.value } }))} disabled={!isEditing} />
                    </div>
                  </div>

                  {/* Filhos */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">Filhos</h4>
                      {isEditing && (
                        <Button type="button" variant="outline" size="sm" onClick={addFilho}>
                          <Plus className="h-4 w-4 mr-1" /> Adicionar filho
                        </Button>
                      )}
                    </div>
                    <div className="space-y-3">
                      {(formData.filhos || []).length === 0 && (
                        <p className="text-xs text-muted-foreground">Nenhum filho cadastrado</p>
                      )}
                      {(formData.filhos || []).map((filho, idx) => (
                        <div key={filho.id} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                          <div className="md:col-span-2">
                            <Label>Nome</Label>
                            <Input value={filho.nome || ''} onChange={e => setFormData(prev => ({
                              ...prev,
                              filhos: (prev.filhos || []).map(f => f.id === filho.id ? { ...f, nome: e.target.value } : f)
                            }))} disabled={!isEditing} placeholder="Nome do filho" />
                          </div>
                          <div>
                            <Label>Data de Nascimento</Label>
                            <Input type="date" value={filho.dataNascimento || ''} onChange={e => setFormData(prev => ({
                              ...prev,
                              filhos: (prev.filhos || []).map(f => f.id === filho.id ? { ...f, dataNascimento: e.target.value } : f)
                            }))} disabled={!isEditing} />
                          </div>
                          {isEditing && (
                            <div className="md:col-span-2 flex justify-end">
                              <Button type="button" variant="ghost" size="sm" onClick={() => removeFilho(filho.id)}>
                                <Trash className="h-4 w-4 mr-1" /> Remover
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba 2: Histórico & Projetos */}
          <TabsContent value="historico" className="space-y-6">
            <Card>
              <CardHeader className="bg-neutral-50">
                <CardTitle>Histórico Completo</CardTitle>
                <CardDescription>
                  Todos os orçamentos e trabalhos realizados para este cliente
                </CardDescription>
              </CardHeader>
              <CardContent className="bg-neutral-50">
                <WorkflowHistoryTable cliente={cliente} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba 3: Resumo Financeiro */}
          <TabsContent value="financeiro" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Resumo Financeiro */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-primary">💰</span>
                    Resumo Financeiro
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Total</span>
                    <span className="font-semibold text-green-600">{formatCurrency(metricas.totalFaturado)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Total Pago</span>
                    <span className="font-semibold text-blue-600">{formatCurrency(metricas.totalPago)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>A Receber</span>
                    <span className="font-semibold text-orange-600">{formatCurrency(metricas.aReceber)}</span>
                  </div>
                  <div className="border-t pt-2">
                    <div className="flex justify-between items-center">
                      <span>Taxa de Pagamento</span>
                      <span className="font-semibold text-primary">
                        {metricas.totalFaturado > 0 ? Math.round(metricas.totalPago / metricas.totalFaturado * 100) : 0}%
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Ticket Médio</span>
                    <span className="font-semibold">
                      {formatCurrency(metricas.totalSessoes > 0 ? metricas.totalFaturado / metricas.totalSessoes : 0)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Engajamento */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-primary">📊</span>
                    Engajamento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Total de Sessões</span>
                    <span className="font-semibold text-blue-600">{metricas.totalSessoes}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Arquivos Enviados</span>
                    <span className="font-semibold">0</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Última Sessão</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Em dia</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Aba 4: Documentos */}
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
                <FileUploadZone clienteId={cliente?.id} description="Documento do cliente" showExisting={true} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>;
}