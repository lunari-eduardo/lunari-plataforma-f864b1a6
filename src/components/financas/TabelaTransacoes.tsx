
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TransacaoFinanceira, CategoriaFinanceira, FiltroTransacao, StatusParcela } from "@/types/financas";
import { formatCurrency } from "@/utils/financialUtils";
import { Pencil, Trash2, Check } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TabelaTransacoesProps {
  transacoes: TransacaoFinanceira[];
  categorias: CategoriaFinanceira[];
  filtro: FiltroTransacao;
  onFiltroChange: (filtro: FiltroTransacao) => void;
  onEditarTransacao: (transacao: TransacaoFinanceira) => void;
  onRemoverTransacao: (id: string) => void;
  onAtualizarStatus: (id: string, status: StatusParcela) => void;
}

export default function TabelaTransacoes({
  transacoes,
  categorias,
  filtro,
  onFiltroChange,
  onEditarTransacao,
  onRemoverTransacao,
  onAtualizarStatus
}: TabelaTransacoesProps) {
  const getStatusBadge = (status: StatusParcela) => {
    const variants = {
      agendado: { variant: "secondary" as const, color: "bg-yellow-100 text-yellow-800" },
      faturado: { variant: "default" as const, color: "bg-orange-100 text-orange-800" },
      pago: { variant: "default" as const, color: "bg-green-100 text-green-800" },
      cancelado: { variant: "destructive" as const, color: "bg-red-100 text-red-800" }
    };

    return variants[status] || variants.agendado;
  };

  const getCategoriaNome = (categoriaId: string) => {
    const categoria = categorias.find(c => c.id === categoriaId);
    return categoria?.nome || 'Categoria não encontrada';
  };

  const getTipoBadge = (tipo: 'receita' | 'despesa') => {
    return tipo === 'receita' 
      ? { variant: "default" as const, color: "bg-green-100 text-green-800" }
      : { variant: "secondary" as const, color: "bg-red-100 text-red-800" };
  };

  const formatarParcela = (transacao: TransacaoFinanceira) => {
    if (transacao.tipoRecorrencia === 'parcelada' && transacao.numeroParcela && transacao.quantidadeParcelas) {
      return `${transacao.numeroParcela}/${transacao.quantidadeParcelas}`;
    }
    return '1/1';
  };

  const getStatusLabel = (status: StatusParcela) => {
    const labels = {
      agendado: 'Agendado',
      faturado: 'Faturado', 
      pago: 'Pago',
      cancelado: 'Cancelado'
    };
    return labels[status] || 'Agendado';
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center">
        <Select
          value={filtro.tipo}
          onValueChange={(value: 'todas' | 'faturadas' | 'agendadas') =>
            onFiltroChange({ ...filtro, tipo: value })
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="faturadas">Somente Faturadas</SelectItem>
            <SelectItem value="agendadas">Somente Agendadas</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filtro.categoria || "todas"}
          onValueChange={(value) =>
            onFiltroChange({ ...filtro, categoria: value === "todas" ? undefined : value })
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {categorias.map(categoria => (
              <SelectItem key={categoria.id} value={categoria.id}>
                {categoria.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Parcelas</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transacoes.map((transacao) => (
            <TableRow key={transacao.id}>
              <TableCell>
                {format(new Date(transacao.data + 'T00:00:00Z'), 'dd/MM/yyyy', { locale: ptBR })}
              </TableCell>
              <TableCell>
                <Badge className={getTipoBadge(transacao.tipo).color}>
                  {transacao.tipo === 'receita' ? 'Receita' : 'Despesa'}
                </Badge>
              </TableCell>
              <TableCell>{getCategoriaNome(transacao.categoriaId)}</TableCell>
              <TableCell>{transacao.descricao}</TableCell>
              <TableCell className={transacao.tipo === 'receita' ? 'text-green-600' : 'text-red-600'}>
                {formatCurrency(transacao.valor)}
              </TableCell>
              <TableCell>{formatarParcela(transacao)}</TableCell>
              <TableCell>
                <Badge className={getStatusBadge(transacao.status).color}>
                  {getStatusLabel(transacao.status)}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  {transacao.status === 'agendado' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onAtualizarStatus(transacao.id, 'faturado')}
                      title="Marcar como faturado"
                    >
                      <Check className="h-3 w-3 text-green-600" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onEditarTransacao(transacao)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onRemoverTransacao(transacao.id)}
                  >
                    <Trash2 className="h-3 w-3 text-red-600" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {transacoes.length === 0 && (
        <div className="text-center py-8 text-neumorphic-textLight">
          Nenhuma transação encontrada para os filtros selecionados.
        </div>
      )}
    </div>
  );
}
