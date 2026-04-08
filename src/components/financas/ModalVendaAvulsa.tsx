import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useVendaAvulsa } from '@/hooks/useVendaAvulsa';
import { ShoppingBag, Loader2, X } from 'lucide-react';
import ClientSearchCombobox from '@/components/agenda/ClientSearchCombobox';
import PackageSearchCombobox from '@/components/agenda/PackageSearchCombobox';
import ProductSearchCombobox, { type ProductComboboxItem } from '@/components/agenda/ProductSearchCombobox';

interface ModalVendaAvulsaProps {
  aberto: boolean;
  onFechar: () => void;
  onSucesso?: () => void;
}

interface ProdutoSelecionado {
  id: string;
  nome: string;
  valorVenda: number;
  quantidade: number;
}

export default function ModalVendaAvulsa({ aberto, onFechar, onSucesso }: ModalVendaAvulsaProps) {
  const { criarVendaAvulsa, loading } = useVendaAvulsa();

  const [clienteId, setClienteId] = useState('');
  const [data, setData] = useState(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  });
  const [pacoteId, setPacoteId] = useState('');
  const [pacoteNome, setPacoteNome] = useState('');
  const [valorBasePacote, setValorBasePacote] = useState(0);
  const [pacoteCategoria, setPacoteCategoria] = useState('');
  const [produtos, setProdutos] = useState<ProdutoSelecionado[]>([]);
  const [valorTotal, setValorTotal] = useState('');
  const [valorManualEditado, setValorManualEditado] = useState(false);
  const [desconto, setDesconto] = useState('');
  const [descricao, setDescricao] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [registrarPagamento, setRegistrarPagamento] = useState(true);

  // Auto-calc valor total
  const valorCalculado = useMemo(() => {
    const totalProdutos = produtos.reduce((sum, p) => sum + p.valorVenda * p.quantidade, 0);
    return valorBasePacote + totalProdutos;
  }, [valorBasePacote, produtos]);

  // Update valor total when auto-calc changes (unless manually edited)
  useEffect(() => {
    if (!valorManualEditado && valorCalculado > 0) {
      setValorTotal(valorCalculado.toFixed(2));
    }
  }, [valorCalculado, valorManualEditado]);

  const valorFinal = useMemo(() => {
    const total = parseFloat(valorTotal) || 0;
    const desc = parseFloat(desconto) || 0;
    return Math.max(0, total - desc);
  }, [valorTotal, desconto]);

  const resetForm = () => {
    setClienteId('');
    setPacoteId('');
    setPacoteNome('');
    setValorBasePacote(0);
    setPacoteCategoria('');
    setProdutos([]);
    setValorTotal('');
    setValorManualEditado(false);
    setDesconto('');
    setDescricao('');
    setObservacoes('');
    setRegistrarPagamento(true);
  };

  const handlePacoteSelect = (id: string, pacoteData?: any) => {
    setPacoteId(id);
    if (pacoteData) {
      setPacoteNome(pacoteData.nome || '');
      setValorBasePacote(pacoteData.valor_base || 0);
      setPacoteCategoria(pacoteData.categoria_id || '');
      setValorManualEditado(false);
    } else {
      setPacoteNome('');
      setValorBasePacote(0);
      setPacoteCategoria('');
    }
  };

  const handleProdutoSelect = (product: ProductComboboxItem | null) => {
    if (!product) return;
    const existing = produtos.find(p => p.id === product.id);
    if (existing) {
      setProdutos(produtos.map(p => p.id === product.id ? { ...p, quantidade: p.quantidade + 1 } : p));
    } else {
      setProdutos([...produtos, { id: product.id, nome: product.nome, valorVenda: product.valorVenda, quantidade: 1 }]);
    }
    setValorManualEditado(false);
  };

  const removeProduto = (id: string) => {
    setProdutos(produtos.filter(p => p.id !== id));
    setValorManualEditado(false);
  };

  const handleSubmit = async () => {
    if (!clienteId || valorFinal <= 0) return;

    const categoria = pacoteCategoria || 'Venda Avulsa';

    try {
      await criarVendaAvulsa({
        clienteId,
        data,
        categoria,
        pacote: pacoteNome || undefined,
        valorBasePacote: valorBasePacote || undefined,
        valorTotal: valorFinal,
        desconto: parseFloat(desconto) || 0,
        descricao: descricao || undefined,
        observacoes: observacoes || undefined,
        registrarPagamento,
      });

      resetForm();
      onSucesso?.();
      onFechar();
    } catch {
      // Error handled in hook
    }
  };

  const isValid = clienteId && (parseFloat(valorTotal) > 0 || valorCalculado > 0);

  return (
    <Dialog open={aberto} onOpenChange={(open) => { if (!open) onFechar(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            Nova Venda Avulsa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Cliente */}
          <div className="space-y-1.5">
            <Label className="text-sm">Cliente *</Label>
            <ClientSearchCombobox
              value={clienteId}
              onSelect={setClienteId}
              placeholder="Buscar cliente por nome, email ou telefone..."
            />
          </div>

          {/* Data */}
          <div className="space-y-1.5">
            <Label className="text-sm">Data *</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>

          {/* Pacote + Produtos em 2 colunas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Pacote</Label>
              <PackageSearchCombobox
                value={pacoteId}
                onSelect={handlePacoteSelect}
                placeholder="Buscar pacote..."
              />
              {pacoteId && valorBasePacote > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Valor base: R$ {valorBasePacote.toFixed(2)}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Produtos</Label>
              <ProductSearchCombobox
                onSelect={handleProdutoSelect}
                placeholder="Buscar produto..."
              />
            </div>
          </div>

          {/* Produtos selecionados como chips */}
          {produtos.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {produtos.map(p => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1 bg-muted text-foreground text-xs px-2 py-1 rounded-md"
                >
                  {p.nome} {p.quantidade > 1 && `×${p.quantidade}`}
                  <span className="text-muted-foreground">R$ {(p.valorVenda * p.quantidade).toFixed(2)}</span>
                  <button
                    type="button"
                    onClick={() => removeProduto(p.id)}
                    className="ml-0.5 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Valor + Desconto */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Valor Total *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={valorTotal}
                onChange={(e) => {
                  setValorTotal(e.target.value);
                  setValorManualEditado(true);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Desconto</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={desconto}
                onChange={(e) => setDesconto(e.target.value)}
              />
            </div>
          </div>

          {/* Valor final */}
          {(parseFloat(desconto) || 0) > 0 && (
            <div className="text-sm text-muted-foreground px-1">
              Valor final: <span className="font-semibold text-foreground">R$ {valorFinal.toFixed(2)}</span>
            </div>
          )}

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label className="text-sm">Descrição</Label>
            <Textarea
              placeholder="Detalhes da venda..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Registrar pagamento */}
          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="registrar-pagamento"
              checked={registrarPagamento}
              onCheckedChange={(checked) => setRegistrarPagamento(!!checked)}
            />
            <Label htmlFor="registrar-pagamento" className="text-sm cursor-pointer">
              Registrar pagamento imediato
            </Label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onFechar} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!isValid || loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Registrar Venda'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
