import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, FileText, MessageCircle, Trash2, Settings, AlertCircle, Pencil, Copy } from 'lucide-react';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { ORIGENS_PADRAO } from '@/utils/defaultOrigens';
import { gerarPDFOrcamento } from '@/utils/pdfUtils';
import { abrirWhatsApp } from '@/utils/whatsappUtils';
import { useToast } from '@/hooks/use-toast';
import { Orcamento } from '@/types/orcamentos';
import StatusBadge from './StatusBadge';
import OrcamentoDetailsModal from './OrcamentoDetailsModal';
import EditOrcamentoModal from './EditOrcamentoModal';

import { formatDateForDisplay, isSameMonthYear, parseDateFromStorage } from '@/utils/dateUtils';

interface ListaOrcamentosProps {
  selectedMonth: Date;
}

export default function ListaOrcamentos({ selectedMonth }: ListaOrcamentosProps) {
  const {
    orcamentos,
    categorias,
    atualizarOrcamento,
    excluirOrcamento,
    adicionarOrcamento
  } = useOrcamentos();
  const {
    toast
  } = useToast();
  const [filtros, setFiltros] = useState({
    busca: '',
    categoria: '',
    status: '',
    origem: ''
  });
  const [selectedOrcamento, setSelectedOrcamento] = useState<Orcamento | null>(null);
  const [orcamentoParaEditar, setOrcamentoParaEditar] = useState<Orcamento | null>(null);
  const [ordenacao, setOrdenacao] = useState<'recentes' | 'antigos'>('recentes');
  
  const [colunasVisiveis, setColunasVisiveis] = useState({
    cliente: true,
    categoria: true,
    status: true,
    dataHora: true,
    valor: true,
    origem: true,
    acoes: true
  });

  // Filtrar orçamentos
  const orcamentosFiltrados = orcamentos.filter(orc => {
    const nomeMatch = orc.cliente?.nome?.toLowerCase().includes(filtros.busca.toLowerCase()) || false;
    const categoriaMatch = !filtros.categoria || filtros.categoria === 'todas' || orc.categoria === filtros.categoria;
    const statusMatch = !filtros.status || filtros.status === 'todos' || orc.status === filtros.status;
    const origemMatch = !filtros.origem || filtros.origem === 'todas' || orc.origemCliente === filtros.origem;
    
    // Aplicar filtro de mês automaticamente baseado no selectedMonth
    // Incluir orçamentos sem data válida (rascunhos) se forem do mês atual
    const dataOrcamento = orc.data ? orc.data : '';
    const mesMatch = dataOrcamento ? isSameMonthYear(dataOrcamento, selectedMonth.toISOString().split('T')[0]) : true;
    
    return nomeMatch && categoriaMatch && statusMatch && mesMatch && origemMatch;
  });

  // Ordenar por data/hora (mais próximos primeiro)
  const orcamentosOrdenados = orcamentosFiltrados.sort((a, b) => {
    // Tratar rascunhos (sem hora) - colocar no final
    const isRascunhoA = !a.hora || a.hora === '';
    const isRascunhoB = !b.hora || b.hora === '';
    
    if (isRascunhoA && !isRascunhoB) return 1; // Rascunho vai para o final
    if (!isRascunhoA && isRascunhoB) return -1; // Normal vem primeiro
    if (isRascunhoA && isRascunhoB) {
      // Ambos são rascunhos, ordenar por nome do cliente
      return a.cliente.nome.localeCompare(b.cliente.nome);
    }
    
    // Ambos têm data/hora, usar ordenação normal
    const dataA = parseDateFromStorage(a.data);
    const dataB = parseDateFromStorage(b.data);
    const [horaA, minA] = a.hora.split(':').map(Number);
    const [horaB, minB] = b.hora.split(':').map(Number);
    dataA.setHours(horaA, minA || 0, 0, 0);
    dataB.setHours(horaB, minB || 0, 0, 0);
    const diff = dataA.getTime() - dataB.getTime();
    return ordenacao === 'recentes' ? -diff : diff;
  });

  // Verificar se orçamento está atrasado (followup há mais de 7 dias)
  const isAtrasado = (orcamento: any) => {
    if (orcamento.status !== 'followup') return false;
    const dataOrc = new Date(orcamento.criadoEm + 'T00:00:00Z');
    const agora = new Date();
    const diffDias = (agora.getTime() - dataOrc.getTime()) / (1000 * 3600 * 24);
    return diffDias > 7;
  };

  const daysUntil = (isoDate: string) => {
    const today = new Date(); today.setHours(0,0,0,0);
    const target = parseDateFromStorage(isoDate);
    const diffMs = target.getTime() - today.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  };
  const exportarPDF = async (orcamento: any) => {
    try {
      const pdfUrl = await gerarPDFOrcamento(orcamento);
      toast({
        title: "PDF Gerado",
        description: "Orçamento exportado com sucesso!"
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao gerar PDF",
        variant: "destructive"
      });
    }
  };
  const enviarWhatsAppOrcamento = (orcamento: any) => {
    abrirWhatsApp(orcamento);
    toast({
      title: "WhatsApp",
      description: "Abrindo WhatsApp..."
    });
  };

  const duplicarOrcamento = (orig: Orcamento) => {
    try {
      const copia: Omit<Orcamento, 'id' | 'criadoEm'> = {
        cliente: orig.cliente,
        data: orig.data,
        hora: orig.hora,
        categoria: orig.categoria,
        descricao: orig.descricao ? `${orig.descricao} (cópia)` : 'Orçamento copiado',
        detalhes: orig.detalhes || '',
        pacotePrincipal: orig.pacotePrincipal,
        produtosAdicionais: orig.produtosAdicionais || [],
        valorFinal: typeof orig.valorFinal === 'number' ? orig.valorFinal : (orig.valorTotal || 0),
        desconto: orig.desconto || 0,
        descontoTipo: orig.descontoTipo,
        validade: orig.validade,
        pacotes: orig.pacotes,
        valorTotal: orig.valorTotal,
        status: 'pendente',
        origemCliente: orig.origemCliente,
        packageId: orig.packageId,
        produtosIncluidos: orig.produtosIncluidos,
        valorFotoExtra: orig.valorFotoExtra
      };
      adicionarOrcamento(copia);
      toast({ title: 'Duplicado', description: 'Orçamento duplicado como rascunho.' });
    } catch (e) {
      toast({ title: 'Erro', description: 'Não foi possível duplicar o orçamento.', variant: 'destructive' });
    }
  };
  const atualizarStatus = (id: string, novoStatus: string) => {
    const orcamento = orcamentos.find(o => o.id === id);
    
    atualizarOrcamento(id, {
      status: novoStatus as any
    });

    // Lógica de negócio para integrações (sem notificações)
    if (novoStatus === 'fechado') {
      if (orcamento) {
        console.log('Orçamento fechado - criando agendamento automático:', orcamento);
        
        // Criar agendamento automaticamente quando o status for fechado
        // Este agendamento será automaticamente sincronizado com o workflow
        const agendamentoData = {
          date: parseDateFromStorage(orcamento.data), // Usar função que trata timezone corretamente
          time: orcamento.hora,
          title: orcamento.cliente.nome,
          type: orcamento.categoria,
          status: 'confirmado' as const,
          description: orcamento.detalhes,
          client: orcamento.cliente.nome,
          clientId: orcamento.cliente.id,
          clientPhone: orcamento.cliente.telefone,
          clientEmail: orcamento.cliente.email,
          paidAmount: 0
        };

        console.log('Dados do agendamento a ser criado:', agendamentoData);
      }
    }
  };
  const limparFiltros = () => {
    setFiltros({
      busca: '',
      categoria: '',
      status: '',
      origem: ''
    });
  };
  return <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-sm">Lista de Orçamentos</CardTitle>
          
        </div>
        
        {/* Filtros responsivos */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mt-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-neumorphic-textLight" />
            <Input placeholder="Buscar por nome..." value={filtros.busca} onChange={e => setFiltros({
            ...filtros,
            busca: e.target.value
          })} className="pl-8" />
          </div>
          
          <Select value={filtros.categoria} onValueChange={value => setFiltros({
          ...filtros,
          categoria: value
        })}>
            <SelectTrigger>
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas categorias</SelectItem>
                {categorias.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
              </SelectContent>
          </Select>

          <Select value={filtros.status} onValueChange={value => setFiltros({
          ...filtros,
          status: value
        })}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="enviado">Enviado</SelectItem>
                <SelectItem value="followup">Followup</SelectItem>
                <SelectItem value="fechado">Fechado</SelectItem>
                <SelectItem value="perdido">Perdido</SelectItem>
              </SelectContent>
          </Select>

          

          <Select value={filtros.origem} onValueChange={value => setFiltros({
          ...filtros,
          origem: value
        })}>
            <SelectTrigger>
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas origens</SelectItem>
              {ORIGENS_PADRAO.map(origem => <SelectItem key={origem.id} value={origem.id}>{origem.nome}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={ordenacao} onValueChange={(v: any) => setOrdenacao(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recentes">Mais recentes</SelectItem>
              <SelectItem value="antigos">Mais antigos</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={() => { limparFiltros(); setOrdenacao('recentes'); }}>
            Limpar
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                {colunasVisiveis.cliente && <TableHead>Cliente</TableHead>}
                {colunasVisiveis.categoria && <TableHead>Categoria</TableHead>}
                {colunasVisiveis.status && <TableHead>Status</TableHead>}
                {colunasVisiveis.dataHora && <TableHead>Data/Hora</TableHead>}
                {colunasVisiveis.valor && <TableHead>Valor</TableHead>}
                {colunasVisiveis.origem && <TableHead>Origem</TableHead>}
                {colunasVisiveis.acoes && <TableHead>Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {orcamentosOrdenados.map(orcamento => {
              const origem = ORIGENS_PADRAO.find(o => o.id === orcamento.origemCliente);
              const valorFinal = orcamento.valorFinal || orcamento.valorTotal;
              const atrasado = isAtrasado(orcamento);
              return <TableRow key={orcamento.id} className={atrasado ? 'bg-red-50' : ''}>
                    {colunasVisiveis.cliente && <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {atrasado && <AlertCircle className="h-4 w-4 text-red-500" />}
                          {orcamento.cliente.nome}
                        </div>
                      </TableCell>}
                    
                    {colunasVisiveis.categoria && <TableCell>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                          {orcamento.categoria}
                        </span>
                      </TableCell>}
                    
                     {colunasVisiveis.status && <TableCell>
                        <Select value={orcamento.status} onValueChange={value => atualizarStatus(orcamento.id, value)}>
                          <SelectTrigger className="w-auto border-none p-0 h-auto">
                            <StatusBadge status={orcamento.status as any} isRascunho={!orcamento.hora || orcamento.hora === ''} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendente">Pendente</SelectItem>
                            <SelectItem value="enviado">Enviado</SelectItem>
                            <SelectItem value="followup">Followup</SelectItem>
                            <SelectItem value="fechado">Fechado</SelectItem>
                            <SelectItem value="perdido">Perdido</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>}
                    
                     {colunasVisiveis.dataHora && <TableCell>
                        <div className="text-xs">
                          {orcamento.hora ? (
                            <>
                              <div className="font-medium">{formatDateForDisplay(orcamento.data)}</div>
                              <div className="text-neumorphic-textLight">{orcamento.hora}</div>
                            </>
                          ) : (
                            <div className="text-amber-600 font-medium">
                              <div>Rascunho</div>
                              <div className="text-xs">Sem data/hora</div>
                            </div>
                          )}
                          {orcamento.validade && (
                            <div className="mt-1 text-[10px]">
                              {(() => {
                                const dias = daysUntil(orcamento.validade!);
                                if (dias < 0) return <span className="text-destructive">Expirado</span>;
                                if (dias <= 3) return <span className="text-amber-600">Vence em {dias} dia{dias === 1 ? '' : 's'}</span>;
                                return <span className="text-muted-foreground">Válido até {formatDateForDisplay(orcamento.validade!)}</span>;
                              })()}
                            </div>
                          )}
                        </div>
                      </TableCell>}
                    
                    {colunasVisiveis.valor && <TableCell className="font-medium">
                        R$ {valorFinal.toFixed(2)}
                      </TableCell>}
                    
                    {colunasVisiveis.origem && <TableCell>
                        {origem && <div className="text-xs px-2 py-1 rounded-full font-medium" style={{
                    backgroundColor: origem.cor + '20',
                    color: origem.cor,
                    border: `1px solid ${origem.cor}40`
                  }}>
                            {origem.nome}
                          </div>}
                      </TableCell>}
                    
                    {colunasVisiveis.acoes && <TableCell>
                        <div className="flex gap-1">
                           <Button size="sm" variant="ghost" onClick={() => setSelectedOrcamento(orcamento)} title="Ver Detalhes">
                             <FileText className="h-3 w-3" />
                           </Button>
                           <Button size="sm" variant="ghost" onClick={() => setOrcamentoParaEditar(orcamento)} title="Editar Orçamento">
                             <Pencil className="h-3 w-3" />
                           </Button>
                           <Button size="sm" variant="ghost" onClick={() => duplicarOrcamento(orcamento)} title="Duplicar Orçamento">
                             <Copy className="h-3 w-3" />
                           </Button>
                           <Button size="sm" variant="ghost" onClick={() => enviarWhatsAppOrcamento(orcamento)} title="Enviar WhatsApp">
                             <MessageCircle className="h-3 w-3" />
                           </Button>
                           <Button size="sm" variant="ghost" onClick={() => excluirOrcamento(orcamento.id)} title="Excluir">
                             <Trash2 className="h-3 w-3" />
                           </Button>
                        </div>
                      </TableCell>}
                  </TableRow>;
            })}
            </TableBody>
          </Table>
        </div>
        
        {orcamentosOrdenados.length === 0 && <div className="text-center py-8">
            <p className="text-neumorphic-textLight">Nenhum orçamento encontrado</p>
          </div>}
        
        {orcamentosOrdenados.length > 0 && <div className="mt-4 text-xs text-neumorphic-textLight text-center">
            Mostrando {orcamentosOrdenados.length} de {orcamentos.length} orçamentos
          </div>}
      </CardContent>

      {/* Modal de Detalhes */}
      <OrcamentoDetailsModal 
        isOpen={!!selectedOrcamento} 
        onClose={() => setSelectedOrcamento(null)} 
        orcamento={selectedOrcamento} 
      />

      {/* Modal de Edição */}
      <EditOrcamentoModal
        isOpen={!!orcamentoParaEditar}
        onClose={() => setOrcamentoParaEditar(null)}
        orcamento={orcamentoParaEditar}
      />

    </Card>;
}