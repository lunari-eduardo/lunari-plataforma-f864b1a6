import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit, Check, X } from 'lucide-react';
import { TransacaoComItem, GrupoPrincipal, NovaTransacaoFinanceira, ItemFinanceiro, StatusTransacao } from '@/types/financas';
import { formatCurrency } from '@/utils/financialUtils';

interface TabelaLancamentosProps {
  transacoes: TransacaoComItem[];
  onAtualizarTransacao: (id: string, dadosAtualizados: Partial<NovaTransacaoFinanceira>) => void;
  onRemoverTransacao: (id: string) => void;
  onMarcarComoPago: (id: string) => void;
  grupoAtivo: GrupoPrincipal;
  obterItensPorGrupo: (grupo: GrupoPrincipal) => ItemFinanceiro[];
}

export default function TabelaLancamentos({
  transacoes,
  onAtualizarTransacao,
  onRemoverTransacao,
  onMarcarComoPago,
  grupoAtivo,
  obterItensPorGrupo
}: TabelaLancamentosProps) {
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [valoresEditando, setValoresEditando] = useState({
    item_id: '',
    valor: '',
    data_vencimento: '',
    observacoes: ''
  });

  const itensDisponiveis = obterItensPorGrupo(grupoAtivo);

  const iniciarEdicao = (t: TransacaoComItem) => {
    setEditandoId(t.id);
    setValoresEditando({
      item_id: t.item_id,
      valor: t.valor.toString(),
      data_vencimento: t.data_vencimento,
      observacoes: t.observacoes || ''
    });
  };

  const salvarEdicao = () => {
    if (!editandoId) return;
    const hoje = new Date().toISOString().split('T')[0];
    const status: StatusTransacao = valoresEditando.data_vencimento <= hoje ? 'Faturado' : 'Agendado';
    onAtualizarTransacao(editandoId, {
      item_id: valoresEditando.item_id,
      valor: parseFloat(valoresEditando.valor) || 0,
      data_vencimento: valoresEditando.data_vencimento,
      observacoes: valoresEditando.observacoes || null,
      status
    });
    setEditandoId(null);
  };

  const formatarData = (dataISO: string) => {
    const [, mes, dia] = dataISO.split('-');
    return `${dia}/${mes}`;
  };

  const getStatusBadge = (status: StatusTransacao, onMarcarPago?: () => void) => {
    const styles: Record<string, string> = {
      Pago: 'bg-lunar-success/15 text-lunar-success border-lunar-success/20',
      Faturado: 'bg-destructive/15 text-destructive border-destructive/20',
      Agendado: 'bg-primary/15 text-primary border-primary/20',
    };
    return (
      <div className="flex items-center gap-1.5">
        <Badge className={`${styles[status] || 'bg-muted text-foreground'} text-[10px] px-1.5 py-0`}>
          {status}
        </Badge>
        {status === 'Faturado' && onMarcarPago && (
          <input
            type="checkbox"
            onChange={onMarcarPago}
            className="w-3.5 h-3.5 text-lunar-success bg-muted border-border rounded focus:ring-lunar-success cursor-pointer"
            title="Marcar como pago"
          />
        )}
      </div>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border/50">
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-16">Data</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Descrição</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-28">Valor</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-24">Status</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-20">Ações</th>
          </tr>
        </thead>
        <tbody>
          {transacoes.map(t => (
            <tr key={t.id} className="group border-b border-border/20 hover:bg-muted/30 transition-colors">
              {editandoId === t.id ? (
                <>
                  <td className="px-3 py-1.5">
                    <Input type="date" value={valoresEditando.data_vencimento} onChange={e => setValoresEditando({ ...valoresEditando, data_vencimento: e.target.value })} className="h-7 text-xs w-full" />
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex gap-2">
                      <Select value={valoresEditando.item_id} onValueChange={v => setValoresEditando({ ...valoresEditando, item_id: v })}>
                        <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {itensDisponiveis.map(item => <SelectItem key={item.id} value={item.id}>{item?.nome || 'Item sem nome'}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input value={valoresEditando.observacoes} onChange={e => setValoresEditando({ ...valoresEditando, observacoes: e.target.value })} placeholder="Obs..." className="h-7 text-xs w-32" />
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    <Input type="number" step="0.01" value={valoresEditando.valor} onChange={e => setValoresEditando({ ...valoresEditando, valor: e.target.value })} className="h-7 text-xs text-right w-full" />
                  </td>
                  <td className="px-3 py-1.5" />
                  <td className="px-3 py-1.5">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={salvarEdicao} className="h-6 w-6 p-0 text-lunar-success"><Check className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditandoId(null)} className="h-6 w-6 p-0 text-muted-foreground"><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </>
              ) : (
                <>
                  <td className="px-3 py-1.5 text-xs text-muted-foreground tabular-nums">
                    {formatarData(t.data_vencimento)}
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-foreground">{t.item?.nome || 'Item não encontrado'}</span>
                      {(t.parcelas || t.parcelaInfo) && (
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0 rounded">
                          {t.parcelas?.atual || t.parcelaInfo?.atual || 1}/{t.parcelas?.total || t.parcelaInfo?.total || 1}
                        </span>
                      )}
                      {t.observacoes && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-32" title={t.observacoes}>
                          {t.observacoes}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <span className="text-sm font-medium text-foreground tabular-nums">{formatCurrency(t.valor)}</span>
                  </td>
                  <td className="px-3 py-1.5">
                    {getStatusBadge(t.status, t.status === 'Faturado' ? () => onMarcarComoPago(t.id) : undefined)}
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" variant="ghost" onClick={() => iniciarEdicao(t)} className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground">
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onRemoverTransacao(t.id)} className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
