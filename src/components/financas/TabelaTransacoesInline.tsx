
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { TransacaoFinanceira, CategoriaFinanceira, StatusParcela, ConfiguracaoParcelamento } from "@/types/financas";
import { formatCurrency } from "@/utils/financialUtils";
import { Plus, Trash2, Edit3, Check, X, Calendar, DollarSign } from "lucide-react";
import ConfiguradorParcelamento from "./ConfiguradorParcelamento";
import ComboboxDescricao from "./ComboboxDescricao";

interface TabelaTransacoesInlineProps {
  transacoes: TransacaoFinanceira[];
  categorias: CategoriaFinanceira[];
  onAtualizarTransacao: (id: string, dados: Partial<TransacaoFinanceira>) => void;
  onRemoverTransacao: (id: string) => void;
  onAdicionarTransacao: (transacao: Omit<TransacaoFinanceira, 'id' | 'userId' | 'criadoEm'>, config?: ConfiguracaoParcelamento) => void;
  tipo: 'despesa_fixa' | 'despesa_variavel' | 'receita_nao_operacional';
  hideFormulario?: boolean;
  descricoesConhecidas: string[];
  onNovaDescricao: (descricao: string) => void;
}

interface NovaTransacao {
  data: string;
  subcategoriaId: string;
  valor: number;
  observacoes: string;
  descricao: string;
  isRecorrente: boolean;
}

export default function TabelaTransacoesInline({
  transacoes,
  categorias,
  onAtualizarTransacao,
  onRemoverTransacao,
  onAdicionarTransacao,
  tipo,
  hideFormulario = false,
  descricoesConhecidas,
  onNovaDescricao
}: TabelaTransacoesInlineProps) {
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [adicionandoNova, setAdicionandoNova] = useState(false);
  const [novaTransacao, setNovaTransacao] = useState<NovaTransacao>({
    data: new Date().toISOString().split('T')[0],
    subcategoriaId: '',
    valor: 0,
    observacoes: '',
    descricao: '',
    isRecorrente: false
  });

  const [configuracaoParcelamento, setConfiguracaoParcelamento] = useState<ConfiguracaoParcelamento>({
    tipo: 'unico',
    dataInicio: new Date().toISOString().split('T')[0],
    quantidadeParcelas: 1
  });

  // Filtra categorias baseado no tipo selecionado
  const categoriasDoTipo = categorias.filter(c => {
    if (tipo === 'despesa_variavel') {
      return c.tipo === 'despesa_variavel' || c.tipo === 'investimento';
    }
    return c.tipo === tipo;
  });
  
  const subcategorias = categoriasDoTipo.flatMap(c => c.subcategorias || []);

  const handleAdicionarNova = () => {
    setAdicionandoNova(true);
    setNovaTransacao({
      data: new Date().toISOString().split('T')[0],
      subcategoriaId: '',
      valor: 0,
      observacoes: '',
      descricao: '',
      isRecorrente: false
    });
    setConfiguracaoParcelamento({
      tipo: 'unico',
      dataInicio: new Date().toISOString().split('T')[0],
      quantidadeParcelas: 1
    });
  };

  const handleSalvarNova = () => {
    if (!novaTransacao.subcategoriaId || novaTransacao.valor <= 0 || !novaTransacao.descricao) return;

    const subcategoria = subcategorias.find(s => s.id === novaTransacao.subcategoriaId);
    const categoria = categoriasDoTipo.find(c => c.id === subcategoria?.categoriaId);
    
    if (!categoria || !subcategoria) return;

    const transacao = {
      tipo: tipo === 'receita_nao_operacional' ? 'receita' as const : 'despesa' as const,
      categoriaId: categoria.id,
      subcategoriaId: subcategoria.id,
      descricao: novaTransacao.descricao,
      valor: novaTransacao.valor,
      data: configuracaoParcelamento.tipo === 'parcelado' ? configuracaoParcelamento.dataInicio : novaTransacao.data,
      observacoes: novaTransacao.observacoes,
      tipoRecorrencia: configuracaoParcelamento.tipo === 'parcelado' ? 'parcelada' as const : 'unica' as const,
      quantidadeParcelas: configuracaoParcelamento.quantidadeParcelas,
      dataInicio: configuracaoParcelamento.dataInicio,
      status: 'agendado' as StatusParcela,
      isRecorrente: tipo === 'despesa_fixa' ? novaTransacao.isRecorrente : false
    };

    onAdicionarTransacao(transacao, configuracaoParcelamento);
    setAdicionandoNova(false);
  };

  const handleCancelarNova = () => {
    setAdicionandoNova(false);
    setNovaTransacao({
      data: new Date().toISOString().split('T')[0],
      subcategoriaId: '',
      valor: 0,
      observacoes: '',
      descricao: '',
      isRecorrente: false
    });
    setConfiguracaoParcelamento({
      tipo: 'unico',
      dataInicio: new Date().toISOString().split('T')[0],
      quantidadeParcelas: 1
    });
  };

  const formatarParcelas = (transacao: TransacaoFinanceira) => {
    if (transacao.tipoRecorrencia === 'parcelada' && transacao.numeroParcela && transacao.quantidadeParcelas) {
      return `${transacao.numeroParcela}/${transacao.quantidadeParcelas}`;
    }
    return 'Única';
  };

  const getStatusColor = (status: StatusParcela) => {
    switch (status) {
      case 'pago': return 'text-green-600 bg-green-50';
      case 'agendado': return 'text-yellow-600 bg-yellow-50';
      case 'cancelado': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // Ordenar transações por data (mais antigas primeiro)
  const transacoesOrdenadas = [...transacoes].sort((a, b) => new Date(a.data + 'T00:00:00Z').getTime() - new Date(b.data + 'T00:00:00Z').getTime());

  return (
    <div className="space-y-4">
      {/* Botão Nova Despesa */}
      {hideFormulario && !adicionandoNova && (
        <div className="flex justify-end">
          <Button 
            onClick={handleAdicionarNova}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova {tipo === 'receita_nao_operacional' ? 'Receita' : 'Despesa'}
          </Button>
        </div>
      )}

      {/* Tabela de transações */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold text-gray-700 text-sm p-3">Data</TableHead>
                <TableHead className="font-semibold text-gray-700 text-sm p-3">Descrição</TableHead>
                <TableHead className="font-semibold text-gray-700 text-sm p-3">Categoria</TableHead>
                <TableHead className="font-semibold text-gray-700 text-sm p-3">Valor</TableHead>
                <TableHead className="font-semibold text-gray-700 text-sm p-3 hidden sm:table-cell">Parcelas</TableHead>
                <TableHead className="font-semibold text-gray-700 text-sm p-3">Status</TableHead>
                {tipo === 'despesa_fixa' && (
                  <TableHead className="font-semibold text-gray-700 text-sm p-3 hidden lg:table-cell">Recorrente</TableHead>
                )}
                <TableHead className="font-semibold text-gray-700 text-sm p-3 hidden lg:table-cell">Obs.</TableHead>
                <TableHead className="font-semibold text-gray-700 text-sm p-3 text-center w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Linha de Nova Transação */}
              {adicionandoNova && (
                <TableRow className="bg-blue-50 border-b-2 border-blue-200">
                  <TableCell className="p-3">
                    <Input
                      type="date"
                      value={configuracaoParcelamento.tipo === 'parcelado' ? configuracaoParcelamento.dataInicio : novaTransacao.data}
                      onChange={(e) => {
                        if (configuracaoParcelamento.tipo === 'parcelado') {
                          setConfiguracaoParcelamento(prev => ({ ...prev, dataInicio: e.target.value }));
                        } else {
                          setNovaTransacao(prev => ({ ...prev, data: e.target.value }));
                        }
                      }}
                      className="w-32 h-8 text-sm"
                    />
                  </TableCell>
                  <TableCell className="p-3">
                    <ComboboxDescricao
                      value={novaTransacao.descricao}
                      onValueChange={(value) => setNovaTransacao(prev => ({ ...prev, descricao: value }))}
                      placeholder="Digite a descrição..."
                      className="w-40 h-8 text-sm"
                      descricoesConhecidas={descricoesConhecidas}
                      onNovaDescricao={onNovaDescricao}
                    />
                  </TableCell>
                  <TableCell className="p-3">
                    <Select
                      value={novaTransacao.subcategoriaId}
                      onValueChange={(value) => setNovaTransacao(prev => ({ ...prev, subcategoriaId: value }))}
                    >
                      <SelectTrigger className="w-40 h-8 text-sm">
                        <SelectValue placeholder="Selecionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {subcategorias.map(sub => (
                          <SelectItem key={sub.id} value={sub.id} className="text-sm">
                            {sub.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="p-3">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        value={novaTransacao.valor || ''}
                        onChange={(e) => setNovaTransacao(prev => ({ ...prev, valor: parseFloat(e.target.value) || 0 }))}
                        className="w-24 h-8 text-sm"
                      />
                      <ConfiguradorParcelamento
                        valor={novaTransacao.valor}
                        configuracao={configuracaoParcelamento}
                        onConfiguracao={setConfiguracaoParcelamento}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="p-3 hidden sm:table-cell">
                    <span className="text-sm text-gray-500">{configuracaoParcelamento.tipo === 'parcelado' ? `${configuracaoParcelamento.quantidadeParcelas}x` : 'Única'}</span>
                  </TableCell>
                  <TableCell className="p-3">
                    <span className="text-sm text-yellow-600">Agendado</span>
                  </TableCell>
                  {tipo === 'despesa_fixa' && (
                    <TableCell className="p-3 hidden lg:table-cell">
                      <Checkbox
                        checked={novaTransacao.isRecorrente}
                        onCheckedChange={(checked) => setNovaTransacao(prev => ({ ...prev, isRecorrente: checked as boolean }))}
                      />
                    </TableCell>
                  )}
                  <TableCell className="p-3 hidden lg:table-cell">
                    <Input
                      value={novaTransacao.observacoes}
                      onChange={(e) => setNovaTransacao(prev => ({ ...prev, observacoes: e.target.value }))}
                      className="w-32 h-8 text-sm"
                      placeholder="Obs..."
                    />
                  </TableCell>
                  <TableCell className="text-center p-3">
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        onClick={handleSalvarNova}
                        disabled={!novaTransacao.subcategoriaId || novaTransacao.valor <= 0 || !novaTransacao.descricao}
                        className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelarNova}
                        className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {/* Transações Existentes */}
              {transacoesOrdenadas.map(transacao => (
                <TableRow key={transacao.id} className="hover:bg-gray-50 transition-colors">
                  <TableCell className="p-3">
                    {editandoId === transacao.id ? (
                      <Input
                        type="date"
                        value={transacao.data}
                        onChange={(e) => onAtualizarTransacao(transacao.id, { data: e.target.value })}
                        className="w-32 h-8 text-sm"
                      />
                    ) : (
                      <span className="text-sm">{new Date(transacao.data + 'T00:00:00Z').toLocaleDateString('pt-BR')}</span>
                    )}
                  </TableCell>
                  <TableCell className="p-3">
                    {editandoId === transacao.id ? (
                      <ComboboxDescricao
                        value={transacao.descricao}
                        onValueChange={(value) => onAtualizarTransacao(transacao.id, { descricao: value })}
                        className="w-40 h-8 text-sm"
                        descricoesConhecidas={descricoesConhecidas}
                        onNovaDescricao={onNovaDescricao}
                      />
                    ) : (
                      <span className="text-sm font-medium">{transacao.descricao}</span>
                    )}
                  </TableCell>
                  <TableCell className="p-3">
                    {editandoId === transacao.id ? (
                      <Select
                        value={transacao.subcategoriaId}
                        onValueChange={(value) => {
                          const subcategoria = subcategorias.find(s => s.id === value);
                          onAtualizarTransacao(transacao.id, {
                            subcategoriaId: value,
                            descricao: subcategoria?.nome || transacao.descricao
                          });
                        }}
                      >
                        <SelectTrigger className="w-40 h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {subcategorias.map(sub => (
                            <SelectItem key={sub.id} value={sub.id} className="text-sm">
                              {sub.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm text-gray-600">
                        {subcategorias.find(s => s.id === transacao.subcategoriaId)?.nome}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="p-3">
                    {editandoId === transacao.id ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={transacao.valor}
                        onChange={(e) => onAtualizarTransacao(transacao.id, { valor: parseFloat(e.target.value) || 0 })}
                        className="w-24 h-8 text-sm"
                      />
                    ) : (
                      <span className="text-sm font-semibold">{formatCurrency(transacao.valor)}</span>
                    )}
                  </TableCell>
                  <TableCell className="p-3 hidden sm:table-cell">
                    <span className="text-sm text-gray-600">{formatarParcelas(transacao)}</span>
                  </TableCell>
                  <TableCell className="p-3">
                    {editandoId === transacao.id ? (
                      <Select
                        value={transacao.status}
                        onValueChange={(value: StatusParcela) => onAtualizarTransacao(transacao.id, { status: value })}
                      >
                        <SelectTrigger className="w-28 h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="agendado" className="text-sm">Agendado</SelectItem>
                          <SelectItem value="pago" className="text-sm">Pago</SelectItem>
                          <SelectItem value="cancelado" className="text-sm">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className={`text-sm px-2 py-1 rounded-full ${getStatusColor(transacao.status)}`}>
                        {transacao.status.charAt(0).toUpperCase() + transacao.status.slice(1)}
                      </span>
                    )}
                  </TableCell>
                  {tipo === 'despesa_fixa' && (
                    <TableCell className="p-3 hidden lg:table-cell">
                      {editandoId === transacao.id ? (
                        <Checkbox
                          checked={transacao.isRecorrente || false}
                          onCheckedChange={(checked) => onAtualizarTransacao(transacao.id, { isRecorrente: checked as boolean })}
                        />
                      ) : (
                        <span className="text-sm">
                          {transacao.isRecorrente ? '✓' : ''}
                        </span>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="p-3 hidden lg:table-cell">
                    {editandoId === transacao.id ? (
                      <Input
                        value={transacao.observacoes || ''}
                        onChange={(e) => onAtualizarTransacao(transacao.id, { observacoes: e.target.value })}
                        className="w-32 h-8 text-sm"
                        placeholder="Obs..."
                      />
                    ) : (
                      <span className="text-sm text-gray-600">{transacao.observacoes}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center p-3">
                    <div className="flex gap-1 justify-center">
                      {editandoId === transacao.id ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => setEditandoId(null)}
                            className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700"
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditandoId(null)}
                            className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditandoId(transacao.id)}
                            className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onRemoverTransacao(transacao.id)}
                            className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {transacoesOrdenadas.length === 0 && !adicionandoNova && (
          <div className="text-center py-12 text-gray-500">
            <div className="text-sm">Nenhuma transação encontrada.</div>
            <div className="text-xs text-gray-400 mt-2">
              Clique em "Nova {tipo === 'receita_nao_operacional' ? 'Receita' : 'Despesa'}" para adicionar.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
