import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { TransacaoFinanceira, CategoriaFinanceira, StatusParcela } from "@/types/financas";
import { formatCurrency } from "@/utils/financialUtils";
import { Pencil, Trash2, Check, X, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
interface TabelaEditavelProps {
  transacoes: TransacaoFinanceira[];
  categorias: CategoriaFinanceira[];
  onAtualizarTransacao: (id: string, dados: Partial<TransacaoFinanceira>) => void;
  onRemoverTransacao: (id: string) => void;
  onAdicionarTransacao: (transacao: Omit<TransacaoFinanceira, 'id' | 'userId' | 'criadoEm'>) => void;
  tipo: 'despesa_fixa' | 'despesa_variavel' | 'receita_nao_operacional';
}
export default function TabelaEditavel({
  transacoes,
  categorias,
  onAtualizarTransacao,
  onRemoverTransacao,
  onAdicionarTransacao,
  tipo
}: TabelaEditavelProps) {
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [novaTransacao, setNovaTransacao] = useState<any>({
    descricao: '',
    valor: '',
    data: new Date().toISOString().split('T')[0],
    status: 'a_pagar',
    parcelado: false,
    quantidadeParcelas: 1,
    dataInicio: new Date().toISOString().split('T')[0]
  });
  const getStatusBadge = (status: StatusParcela) => {
    const configs = {
      a_pagar: {
        color: "bg-red-100 text-red-800",
        label: "A Pagar"
      },
      faturado: {
        color: "bg-green-100 text-green-800",
        label: "Faturado"
      },
      cancelado: {
        color: "bg-gray-100 text-gray-800",
        label: "Cancelado"
      }
    };
    return configs[status] || configs.a_pagar;
  };
  const categoriasDoTipo = categorias.filter(c => c.tipo === tipo);
  const subcategorias = categoriasDoTipo.flatMap(c => c.subcategorias || []);
  const handleSalvarNovaTransacao = () => {
    if (!novaTransacao.descricao || !novaTransacao.valor || !novaTransacao.subcategoriaId) {
      console.log('Campos obrigatórios não preenchidos');
      return;
    }
    const subcategoria = subcategorias.find(s => s.id === novaTransacao.subcategoriaId);
    const categoria = categoriasDoTipo.find(c => c.id === subcategoria?.categoriaId);
    if (!categoria || !subcategoria) {
      console.log('Categoria ou subcategoria não encontrada');
      return;
    }
    const valorNumerico = parseFloat(novaTransacao.valor.toString().replace(',', '.'));
    if (isNaN(valorNumerico)) {
      console.log('Valor inválido');
      return;
    }
    const transacao = {
      tipo: tipo === 'receita_nao_operacional' ? 'receita' as const : 'despesa' as const,
      categoriaId: categoria.id,
      subcategoriaId: subcategoria.id,
      descricao: subcategoria.nome,
      valor: valorNumerico,
      data: novaTransacao.parcelado ? novaTransacao.dataInicio : novaTransacao.data,
      status: novaTransacao.status,
      tipoRecorrencia: novaTransacao.parcelado ? 'parcelada' as const : 'unica' as const,
      quantidadeParcelas: novaTransacao.parcelado ? parseInt(novaTransacao.quantidadeParcelas) : undefined,
      dataInicio: novaTransacao.parcelado ? novaTransacao.dataInicio : undefined
    };
    console.log('Adicionando transação:', transacao);
    onAdicionarTransacao(transacao);

    // Limpar formulário
    setNovaTransacao({
      descricao: '',
      valor: '',
      data: new Date().toISOString().split('T')[0],
      status: 'a_pagar',
      parcelado: false,
      quantidadeParcelas: 1,
      dataInicio: new Date().toISOString().split('T')[0],
      subcategoriaId: ''
    });
  };
  const getSubcategoriaNome = (subcategoriaId?: string) => {
    const subcategoria = subcategorias.find(s => s.id === subcategoriaId);
    return subcategoria?.nome || 'Não definida';
  };
  const handleEditarValor = (transacaoId: string, novoValor: string) => {
    const valorNumerico = parseFloat(novoValor.replace(',', '.'));
    if (!isNaN(valorNumerico)) {
      onAtualizarTransacao(transacaoId, {
        valor: valorNumerico
      });
    }
  };
  return <div className="space-y-4">
      {/* Linha de cadastro no topo */}
      <div className="p-4 rounded-lg border-2 border-blue-200 bg-neumorphic-base">
        <h4 className="text-sm font-medium mb-3 text-blue-800">Adicionar Nova Transação</h4>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Data</label>
            <Input type="date" value={novaTransacao.parcelado ? novaTransacao.dataInicio : novaTransacao.data} onChange={e => {
            if (novaTransacao.parcelado) {
              setNovaTransacao(prev => ({
                ...prev,
                dataInicio: e.target.value
              }));
            } else {
              setNovaTransacao(prev => ({
                ...prev,
                data: e.target.value
              }));
            }
          }} className="h-9" />
            {novaTransacao.parcelado && <span className="text-xs text-gray-500">Data da 1ª Parcela</span>}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Descrição</label>
            <Select value={novaTransacao.subcategoriaId || ''} onValueChange={value => {
            const subcategoria = subcategorias.find(s => s.id === value);
            setNovaTransacao(prev => ({
              ...prev,
              subcategoriaId: value,
              descricao: subcategoria?.nome || ''
            }));
          }}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                {subcategorias.map(sub => <SelectItem key={sub.id} value={sub.id}>
                    {sub.nome}
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Valor</label>
            <Input type="number" step="0.01" placeholder="0,00" value={novaTransacao.valor} onChange={e => setNovaTransacao(prev => ({
            ...prev,
            valor: e.target.value
          }))} className="h-9" />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Parcelado</label>
            <div className="flex items-center gap-2">
              <Switch checked={novaTransacao.parcelado} onCheckedChange={checked => setNovaTransacao(prev => ({
              ...prev,
              parcelado: checked
            }))} />
              {novaTransacao.parcelado && <Input type="number" min="2" max="12" value={novaTransacao.quantidadeParcelas} onChange={e => setNovaTransacao(prev => ({
              ...prev,
              quantidadeParcelas: parseInt(e.target.value)
            }))} className="w-16 h-9" placeholder="2" />}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Situação</label>
            <Select value={novaTransacao.status} onValueChange={value => setNovaTransacao(prev => ({
            ...prev,
            status: value
          }))}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a_pagar">A Pagar</SelectItem>
                <SelectItem value="faturado">Faturado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Button onClick={handleSalvarNovaTransacao} disabled={!novaTransacao.descricao || !novaTransacao.valor || !novaTransacao.subcategoriaId} className="h-9 w-full">
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>
        </div>
      </div>

      {/* Tabela de transações */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Parcelas</TableHead>
            <TableHead>Situação</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transacoes.map(transacao => <TableRow key={transacao.id}>
              <TableCell>
                {editandoId === transacao.id ? <Input type="date" defaultValue={transacao.data} onChange={e => onAtualizarTransacao(transacao.id, {
              data: e.target.value
            })} className="w-32" /> : format(new Date(transacao.data + 'T00:00:00Z'), 'dd/MM/yyyy', {
              locale: ptBR
            })}
              </TableCell>
              <TableCell>
                {editandoId === transacao.id ? <Select defaultValue={transacao.subcategoriaId} onValueChange={value => {
              const subcategoria = subcategorias.find(s => s.id === value);
              onAtualizarTransacao(transacao.id, {
                subcategoriaId: value,
                descricao: subcategoria?.nome || transacao.descricao
              });
            }}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {subcategorias.map(sub => <SelectItem key={sub.id} value={sub.id}>
                          {sub.nome}
                        </SelectItem>)}
                    </SelectContent>
                  </Select> : getSubcategoriaNome(transacao.subcategoriaId)}
              </TableCell>
              <TableCell>
                {editandoId === transacao.id ? <Input type="number" step="0.01" defaultValue={transacao.valor} onChange={e => handleEditarValor(transacao.id, e.target.value)} className="w-24" /> : <span className={transacao.tipo === 'receita' ? 'text-green-600' : 'text-red-600'}>
                    {formatCurrency(transacao.valor)}
                  </span>}
              </TableCell>
              <TableCell>
                {transacao.tipoRecorrencia === 'parcelada' ? `${transacao.numeroParcela}/${transacao.quantidadeParcelas}` : '1/1'}
              </TableCell>
              <TableCell>
                {editandoId === transacao.id ? <Select defaultValue={transacao.status} onValueChange={(value: StatusParcela) => onAtualizarTransacao(transacao.id, {
              status: value
            })}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a_pagar">A Pagar</SelectItem>
                      <SelectItem value="faturado">Faturado</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select> : <Badge className={getStatusBadge(transacao.status).color}>
                    {getStatusBadge(transacao.status).label}
                  </Badge>}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  {editandoId === transacao.id ? <>
                      <Button size="sm" variant="ghost" onClick={() => setEditandoId(null)} title="Salvar alterações">
                        <Check className="h-3 w-3 text-green-600" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditandoId(null)} title="Cancelar edição">
                        <X className="h-3 w-3 text-red-600" />
                      </Button>
                    </> : <>
                      <Button size="sm" variant="ghost" onClick={() => setEditandoId(transacao.id)} title="Editar transação">
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onRemoverTransacao(transacao.id)} title="Remover transação">
                        <Trash2 className="h-3 w-3 text-red-600" />
                      </Button>
                    </>}
                </div>
              </TableCell>
            </TableRow>)}
        </TableBody>
      </Table>

      {transacoes.length === 0 && <div className="text-center py-8 text-gray-500">
          Nenhuma transação encontrada. Use o formulário acima para adicionar uma nova.
        </div>}
    </div>;
}