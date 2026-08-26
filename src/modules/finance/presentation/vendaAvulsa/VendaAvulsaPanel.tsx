/**
 * VendaAvulsaPanel — painel lateral (SidePanel) para registrar vendas avulsas.
 *
 * Regras oficiais (Lunari):
 *  - Venda avulsa é SEMPRE venda de produto. Não existe venda avulsa de pacote
 *    (pacote/agendamento é fluxo exclusivo da Agenda) — evita duplicidade de
 *    fontes de agendamento e receita fantasma.
 *  - Sem categoria e sem etapa: a receita pertence ao produto e o registro
 *    entra no Workflow apenas para acompanhamento de produção/entrega.
 */
import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ShoppingBag, Loader2, X, UserPlus, Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';
import ClientSearchCombobox from '@/components/agenda/ClientSearchCombobox';
import ProductSearchCombobox, { type ProductComboboxItem } from '@/components/agenda/ProductSearchCombobox';
import { useVendaAvulsa } from '@/hooks/useVendaAvulsa';
import { useClientesRealtime } from '@/hooks/useClientesRealtime';
import { SidePanel } from '@/modules/finance/presentation/shell/SidePanel';
import { SectionHeader } from '@/modules/finance/presentation/shell/fields/SectionHeader';
import { DisclosureSection } from '@/modules/finance/presentation/shell/fields/DisclosureSection';
import { Switch } from '@/components/ui/switch';
import { ChargeModal } from '@/components/cobranca/ChargeModal';
import { SmartSelect, PaidToggle, type SmartSelectOption } from '@/modules/finance/presentation/shell/fields';

const FORMAS_PAGAMENTO: SmartSelectOption[] = [
  { value: 'pix', label: 'PIX' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'cartao_debito', label: 'Cartão de débito' },
  { value: 'cartao_credito', label: 'Cartão de crédito' },
];


interface VendaAvulsaPanelProps {
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

export default function VendaAvulsaPanel({ aberto, onFechar, onSucesso }: VendaAvulsaPanelProps) {
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
  const [produtos, setProdutos] = useState<ProdutoSelecionado[]>([]);
  const [valorTotal, setValorTotal] = useState('');
  const [valorManualEditado, setValorManualEditado] = useState(false);
  const [desconto, setDesconto] = useState('');
  const [descricaoExtra, setDescricaoExtra] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [registrarPagamento, setRegistrarPagamento] = useState(true);
  const [formaPagamento, setFormaPagamento] = useState('pix');
  const [gerarCobrancaOnline, setGerarCobrancaOnline] = useState(false);
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);

  const valorCalculado = useMemo(
    () => produtos.reduce((sum, p) => sum + p.valorVenda * p.quantidade, 0),
    [produtos],
  );

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

  const descricaoAutomatica = useMemo(() => {
    return produtos
      .map((p) => (p.quantidade > 1 ? `${p.nome} (x${p.quantidade})` : p.nome))
      .join(' + ');
  }, [produtos]);

  const descricaoFinal = useMemo(() => {
    const parts: string[] = [];
    if (descricaoAutomatica) parts.push(descricaoAutomatica);
    if (descricaoExtra.trim()) parts.push(descricaoExtra.trim());
    return parts.join(' — ') || 'Venda avulsa';
  }, [descricaoAutomatica, descricaoExtra]);

  const resetForm = () => {
    setClienteId('');
    setProdutos([]);
    setValorTotal('');
    setValorManualEditado(false);
    setDesconto('');
    setDescricaoExtra('');
    setObservacoes('');
    setRegistrarPagamento(true);
    setFormaPagamento('pix');
    setGerarCobrancaOnline(false);
  };

  const handleProdutoSelect = (product: ProductComboboxItem | null) => {
    if (!product) return;
    const existing = produtos.find((p) => p.id === product.id);
    if (existing) {
      setProdutos(produtos.map((p) => (p.id === product.id ? { ...p, quantidade: p.quantidade + 1 } : p)));
    } else {
      setProdutos([...produtos, { id: product.id, nome: product.nome, valorVenda: product.valorVenda, quantidade: 1 }]);
    }
    setValorManualEditado(false);
  };

  const updateQuantidade = (id: string, delta: number) => {
    setProdutos((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        return { ...p, quantidade: Math.max(1, p.quantidade + delta) };
      }),
    );
    setValorManualEditado(false);
  };

  const removeProduto = (id: string) => {
    setProdutos(produtos.filter((p) => p.id !== id));
    setValorManualEditado(false);
  };

  const handleSubmit = async () => {
    if (!clienteId || valorFinal <= 0) return;

    try {
      const sessao = await criarVendaAvulsa({
        clienteId,
        data,
        // Venda avulsa nunca inventa categoria nem pacote — a receita é do produto.
        categoria: '',
        pacote: undefined,
        valorBasePacote: 0,
        valorTotal: valorFinal,
        desconto: parseFloat(desconto) || 0,
        descricao: descricaoFinal,
        observacoes: observacoes || undefined,
        registrarPagamento,
        formaPagamento,
        produtos: produtos.map((p) => ({
          nome: p.nome,
          quantidade: p.quantidade,
          valorUnitario: p.valorVenda,
        })),
      });

      if (!registrarPagamento && gerarCobrancaOnline && sessao?.session_id) {
        setCreatedSessionId(sessao.session_id);
        // Do not close the side panel yet or reset form, so ChargeModal can render.
        // If we close, the modal unmounts. Actually, let's reset form except for ChargeModal state.
        return;
      }

      resetForm();
      onSucesso?.();
      onFechar();
    } catch {
      // Erro tratado no hook
    }
  };

  const isValid = clienteId && (parseFloat(valorTotal) > 0 || valorCalculado > 0);
  const maisOpcoesFilled = observacoes.trim() ? 1 : 0;

  return (
    <>
    <SidePanel
      open={aberto}
      onOpenChange={(v) => !v && onFechar()}
      icone={ShoppingBag}
      titulo="Nova venda avulsa"
      subtitulo="Registre uma venda de produtos fora do workflow."
      width="md"
      footer={
        <SidePanel.Footer
          left={
            <Button variant="ghost" size="sm" onClick={onFechar} disabled={loading}>
              Cancelar
            </Button>
          }
          right={
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!isValid || loading}
                className="shadow-[0_8px_20px_-8px_hsl(var(--accent-gold)/0.5)]"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Salvando…
                  </>
                ) : (
                  'Registrar venda'
                )}
              </Button>
            </div>
          }
        />
      }
    >
      <div className="space-y-5">
        {/* Essencial */}
        <section className="space-y-3">
          <SectionHeader label="Essencial" />

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Cliente *</Label>
            {!showNovoCliente ? (
              <ClientSearchCombobox
                value={clienteId}
                onSelect={setClienteId}
                placeholder="Buscar cliente por nome, email ou telefone…"
                onAddNew={() => setShowNovoCliente(true)}
              />
            ) : (
              <div className="space-y-2 p-3 border border-border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium flex items-center gap-1.5">
                    <UserPlus className="h-3.5 w-3.5 text-accent-gold" />
                    Novo cliente
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowNovoCliente(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowNovoCliente(false)}
                    className="text-xs h-7"
                  >
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
                        // erro tratado no hook
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

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Data *</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
        </section>

        {/* Itens da venda */}
        <section className="space-y-3">
          <SectionHeader label="Produtos" />

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Adicionar produto</Label>
            <ProductSearchCombobox onSelect={handleProdutoSelect} placeholder="Buscar produto…" />
          </div>

          {produtos.length > 0 && (
            <div className="space-y-1.5">
              {produtos.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between bg-muted/60 text-foreground text-xs px-2.5 py-1.5 rounded-md"
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

          {descricaoAutomatica && (
            <div className="text-[11px] text-muted-foreground px-1">📋 {descricaoAutomatica}</div>
          )}
        </section>

        {/* Valores */}
        <section className="space-y-3">
          <SectionHeader label="Valores" />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Valor total *</Label>
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
              <Label className="text-xs text-muted-foreground">Desconto</Label>
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

          {(parseFloat(desconto) || 0) > 0 && (
            <div className="text-sm text-muted-foreground px-1">
              Valor final:{' '}
              <span className="font-semibold text-foreground">R$ {valorFinal.toFixed(2)}</span>
            </div>
          )}
        </section>

        {/* Pagamento */}
        <section className="space-y-3">
          <SectionHeader label="Pagamento" />
          <div className="flex items-center justify-between bg-muted/20 border border-border/50 rounded-lg p-3">
            <PaidToggle
              checked={registrarPagamento}
              onChange={setRegistrarPagamento}
              label="Recebido"
              labelInactive="A receber"
            />
          </div>
          
          {registrarPagamento && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
              <Label className="text-xs text-muted-foreground">Forma de pagamento</Label>
              <SmartSelect
                value={formaPagamento}
                onChange={setFormaPagamento}
                options={FORMAS_PAGAMENTO}
                placeholder="Não informado"
              />
            </div>
          )}

          {!registrarPagamento && (
            <div className="flex items-center justify-between bg-muted/20 border border-border/50 rounded-lg p-3 animate-in fade-in slide-in-from-top-2">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Gerar cobrança online agora</Label>
                <div className="text-xs text-muted-foreground">
                  Abre o painel para gerar Pix ou link de pagamento.
                </div>
              </div>
              <Switch
                checked={gerarCobrancaOnline}
                onCheckedChange={setGerarCobrancaOnline}
              />
            </div>
          )}
        </section>

        {/* Mais opções */}
        <DisclosureSection title="Mais opções" filledCount={maisOpcoesFilled}>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Observações adicionais</Label>
              <Textarea
                placeholder="Detalhes extras da venda…"
                value={descricaoExtra}
                onChange={(e) => setDescricaoExtra(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Notas internas</Label>
              <Textarea
                placeholder="Notas privadas…"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>
          </div>
        </DisclosureSection>
      </div>
    </SidePanel>
    
    <ChargeModal
      isOpen={!!createdSessionId}
      onClose={() => {
        setCreatedSessionId(null);
        resetForm();
        onSucesso?.();
        onFechar();
      }}
      clienteId={clienteId}
      sessionId={createdSessionId || ''}
      valorSugerido={valorFinal}
      allowChangeValor={false}
      descricao={descricaoFinal}
    />
    </>
  );
}
