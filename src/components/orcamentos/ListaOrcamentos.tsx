import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, FileText, MessageCircle, Trash2, Settings, AlertCircle, Pencil } from 'lucide-react';
import { useOrcamentos } from '@/hooks/useOrcamentos';
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
    origens,
    atualizarOrcamento,
    excluirOrcamento
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
    const categoriaMatch = !filtros.categoria || orc.categoria === filtros.categoria;
    const statusMatch = !filtros.status || orc.status === filtros.status;
    const origemMatch = !filtros.origem || orc.origemCliente === filtros.origem;
    
    // Aplicar filtro de mês automaticamente baseado no selectedMonth
    const mesMatch = isSameMonthYear(orc.data, selectedMonth.toISOString().split('T')[0]);
    
    return nomeMatch && categoriaMatch && statusMatch && mesMatch && origemMatch;
  });

  // Ordenar por data/hora (mais próximos primeiro)
  const orcamentosOrdenados = orcamentosFiltrados.sort((a, b) => {
    const dataA = parseDateFromStorage(a.data);
    const dataB = parseDateFromStorage(b.data);
    // Adicionar hora se necessário para comparação
    const [horaA] = a.hora.split(':').map(Number);
    const [horaB] = b.hora.split(':').map(Number);
    dataA.setUTCHours(horaA);
    dataB.setUTCHours(horaB);
    return dataA.getTime() - dataB.getTime();
  });

  // Verificar se orçamento está atrasado (follow-up há mais de 7 dias)
  const isAtrasado = (orcamento: any) => {
    if (orcamento.status !== 'follow-up') return false;
    const dataOrc = new Date(orcamento.criadoEm + 'T00:00:00Z');
    const agora = new Date();
    const diffDias = (agora.getTime() - dataOrc.getTime()) / (1000 * 3600 * 24);
    return diffDias > 7;
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
              <SelectItem value="rascunho">Novo</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="enviado">Enviado</SelectItem>
              <SelectItem value="follow-up">Follow-up</SelectItem>
              <SelectItem value="fechado">Fechado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
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
              {origens.map(origem => <SelectItem key={origem.id} value={origem.id}>{origem.nome}</SelectItem>)}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={limparFiltros}>
            Limpar
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-white z-10">
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
              const origem = origens.find(o => o.id === orcamento.origemCliente);
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
                            <StatusBadge status={orcamento.status as any} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="rascunho">Novo</SelectItem>
                            <SelectItem value="pendente">Pendente</SelectItem>
                            <SelectItem value="enviado">Enviado</SelectItem>
                            <SelectItem value="follow-up">Follow-up</SelectItem>
                            <SelectItem value="fechado">Fechado</SelectItem>
                            <SelectItem value="cancelado">Cancelado</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>}
                    
                     {colunasVisiveis.dataHora && <TableCell>
                        <div className="text-xs">
                          <div className="font-medium">{formatDateForDisplay(orcamento.data)}</div>
                          <div className="text-neumorphic-textLight">{orcamento.hora}</div>
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