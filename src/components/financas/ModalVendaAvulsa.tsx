import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useVendaAvulsa } from '@/hooks/useVendaAvulsa';
import { useClientesRealtime } from '@/hooks/useClientesRealtime';
import { ShoppingBag, Loader2, X, UserPlus, Plus, Minus } from 'lucide-react';
import ClientSearchCombobox from '@/components/agenda/ClientSearchCombobox';
import PackageSearchCombobox from '@/components/agenda/PackageSearchCombobox';
import ProductSearchCombobox, { type ProductComboboxItem } from '@/components/agenda/ProductSearchCombobox';
import { toast } from 'sonner';

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
  const { adicionarCliente } = useClientesRealtime();

  const [clienteId, setClienteId] = useState('');
  const [showNovoCliente, setShowNovoCliente] = useState(false);
  const [novoClienteNome, setNovoClienteNome] = useState('');
  const [novoClienteTelefone, setNovoClienteTelefone] = useState('');
  const [novoClienteEmail, setNovoClienteEmail] = useState('');
  const [salvandoCliente, setSalvandoCliente] = useState(false);
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
  const [descricaoExtra, setDescricaoExtra] = useState('');
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

  // Auto-generate description
  const descricaoAutomatica = useMemo(() => {
    const partes: string[] = [];
    if (pacoteNome) partes.push(pacoteNome);
    produtos.forEach(p => {
      partes.push(p.quantidade > 1 ? `${p.nome} (x${p.quantidade})` : p.nome);
    });
    return partes.length > 0 ? partes.join(' + ') : '';
  }, [pacoteNome, produtos]);

  const descricaoFinal = useMemo(() => {
    const parts: string[] = [];
    if (descricaoAutomatica) parts.push(descricaoAutomatica);
    if (descricaoExtra.trim()) parts.push(descricaoExtra.trim());
    return parts.join(' — ') || 'Venda avulsa';
  }, [descricaoAutomatica, descricaoExtra]);

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
    setDescricaoExtra('');
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

  const updateQuantidade = (id: string, delta: number) => {
    setProdutos(prev => prev.map(p => {
      if (p.id !== id) return p;
      const novaQtd = Math.max(1, p.quantidade + delta);
      return { ...p, quantidade: novaQtd };
    }));
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
        descricao: descricaoFinal,
        observacoes: observacoes || undefined,
        registrarPagamento,
        produtos: produtos.map(p => ({
          nome: p.nome,
          quantidade: p.quantidade,
          valorUnitario: p.valorVenda,
        })),
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
            {!showNovoCliente ? (
              <ClientSearchCombobox
                value={clienteId}
                onSelect={setClienteId}
                placeholder="Buscar cliente por nome, email ou telefone..."
                onAddNew={() => setShowNovoCliente(true)}
              />
            ) : (
              <div className="space-y-2 p-3 border border-border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium flex items-center gap-1.5">
                    <UserPlus className="h-3.5 w-3.5 text-primary" />
                    Novo Cliente
                  </span>
                  <button type="button" onClick={() => setShowNovoCliente(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Input
                  placeholder="Nome *"
                  value={novoClienteNome}
                  onChange={(e) => setNovoClienteNome(e.target.value)}
                  className="text-xs"
                  autoComplete="off"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Telefone"
                    value={novoClienteTelefone}
                    onChange={(e) => setNovoClienteTelefone(e.target.value)}
                    className="text-xs"
                    autoComplete="off"
                  />
                  <Input
                    placeholder="Email"
                    value={novoClienteEmail}
                    onChange={(e) => setNovoClienteEmail(e.target.value)}
                    className="text-xs"
                    autoComplete="off"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowNovoCliente(false)} className="text-xs h-7">
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="text-xs h-7"
                    disabled={!novoClienteNome.trim() || salvandoCliente}
                    onClick={async () => {
                      setSalvandoCliente(true);
                      try {
                        const novo = await adicionarCliente({
                          nome: novoClienteNome.trim(),
                          telefone: novoClienteTelefone.trim() || null,
                          email: novoClienteEmail.trim() || null,
                        });
                        if (novo?.id) {
                          setClienteId(novo.id);
                          toast.success('Cliente cadastrado!');
                        }
                        setShowNovoCliente(false);
                        setNovoClienteNome('');
                        setNovoClienteTelefone('');
                        setNovoClienteEmail('');
                      } catch {
                        // error handled in hook
                      } finally {
                        setSalvandoCliente(false);
                      }
                    }}
                  >
                    {salvandoCliente ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Salvar'}
                  </Button>
                </div>
              </div>
            )}
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

          {/* Produtos selecionados com controles de quantidade */}
          {produtos.length > 0 && (
            <div className="space-y-1.5">
              {produtos.map(p => (
                <div
                  key={p.id}
                  className="flex items-center justify-between bg-muted text-foreground text-xs px-2.5 py-1.5 rounded-md"
                >
                  <span className="flex-1 truncate">{p.nome}</span>
                  <div className="flex items-center gap-1.5 ml-2">
                    <button
                      type="button"
                      onClick={() => updateQuantidade(p.id, -1)}
                      className="h-5 w-5 flex items-center justify-center rounded hover:bg-background"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-5 text-center font-medium">{p.quantidade}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantidade(p.id, 1)}
                      className="h-5 w-5 flex items-center justify-center rounded hover:bg-background"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <span className="text-muted-foreground ml-1 min-w-[60px] text-right">
                      R$ {(p.valorVenda * p.quantidade).toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeProduto(p.id)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Descrição automática preview */}
          {descricaoAutomatica && (
            <div className="text-[11px] text-muted-foreground px-1">
              📋 {descricaoAutomatica}
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

          {/* Descrição complementar */}
          <div className="space-y-1.5">
            <Label className="text-sm">Observações adicionais</Label>
            <Textarea
              placeholder="Detalhes extras da venda..."
              value={descricaoExtra}
              onChange={(e) => setDescricaoExtra(e.target.value)}
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
