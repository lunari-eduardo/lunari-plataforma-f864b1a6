/**
 * LancamentoForm — Etapa 5 do redesign de Lançamentos.
 *
 * Formulário contextual único, dirigido pela taxonomia
 * `LancamentoTipoMeta` (essenciais / permitidos / datas).
 *
 * Persistência: reaproveita `useNovoFinancas.createTransactionEngine` +
 * `adicionarItemFinanceiro` (inline). Metadados sem coluna dedicada
 * (favorecido / forma de pagamento / descrição) são compostos no
 * `observacoes` para não perder informação — mesma estratégia usada
 * pelo modal legado enquanto a Onda 6 do módulo Finance ainda não expõe
 * colunas próprias.
 */
import { memo, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { useNovoFinancas } from '@/hooks/useNovoFinancas';
import {
  getLancamentoTipoMeta,
  isCampoPermitido,
  type LancamentoTipo,
} from '@/modules/finance/domain/lancamentoTipos';
import {
  CurrencyField,
  DateField,
  DisclosureSection,
  FieldRow,
  PaidToggle,
  SectionHeader,
  SmartSelect,
  TextAreaField,
  TextField,
  type SmartSelectOption,
} from './fields';



import { useCreditCardsSupabase } from '@/hooks/useCreditCardsSupabase';

// ─────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────

const FORMAS_PAGAMENTO: SmartSelectOption[] = [
  { value: 'pix', label: 'PIX' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'cartao_debito', label: 'Cartão de débito' },
  { value: 'cartao_credito', label: 'Cartão de crédito' },
];

function hoje(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// ─────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────

interface FormState {
  valor: number;
  itemId: string | null;
  favorecido: string;
  descricao: string;
  competencia: string | null;
  vencimento: string | null;
  recebimento: string | null;
  formaPagamento: string | null;
  cartaoId: string | null;
  numeroParcelas: number;
  isRecorrente: boolean;
  isValorFixo: boolean;
  observacoes: string;
  pago: boolean;
}

function initialState(tipo: LancamentoTipo): FormState {
  const meta = getLancamentoTipoMeta(tipo);
  return {
    valor: 0,
    itemId: null,
    favorecido: '',
    descricao: '',
    competencia: hoje(),
    vencimento: hoje(),
    recebimento: hoje(),
    formaPagamento: null,
    cartaoId: null,
    numeroParcelas: 1,
    isRecorrente: false,
    isValorFixo: true,
    observacoes: '',
    // Receitas: default = já recebido. Despesas/investimento: default = pendente.
    pago: meta.natureza === 'entrada',
  };
}

// ─────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────

interface Props {
  tipo: LancamentoTipo;
  onClose: () => void;
  onCreated?: () => void;
  isMobile?: boolean;
  /** Quando presente (natureza "entrada"), mostra atalho para o painel de Venda Avulsa. */
  onSelectVendaAvulsa?: () => void;
}

export const LancamentoForm = memo(function LancamentoForm({ tipo, onClose, onCreated, isMobile = false, onSelectVendaAvulsa }: Props) {
  const meta = getLancamentoTipoMeta(tipo);
  const { toast } = useToast();
  const {
    obterItensPorGrupo,
    adicionarItemFinanceiro,
    createTransactionEngine,
  } = useNovoFinancas();
  const { cartoes = [] } = useCreditCardsSupabase();

  const [state, setState] = useState<FormState>(() => initialState(tipo));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // reset quando muda o tipo
    setState(initialState(tipo));
  }, [tipo]);

  const grupo = meta.gruposPermitidos[0];
  const itens = obterItensPorGrupo(grupo as any);
  const categoriaOptions = useMemo<SmartSelectOption[]>(
    () => itens.map((i: any) => ({ value: i.id, label: i.nome })),
    [itens],
  );

  const cartoesOptions = useMemo<SmartSelectOption[]>(
    () => cartoes.filter(c => c.ativo).map(c => ({ value: c.id, label: c.nome })),
    [cartoes]
  );

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const showCategoria = isCampoPermitido(tipo, 'categoria');
  const showFavorecido = isCampoPermitido(tipo, 'favorecido') && meta.natureza === 'saida';
  const showDescricaoAtivo = tipo === 'investimento';
  const showDescricao = tipo === 'receita_nao_operacional';
  const showRecebimento = meta.datas.includes('recebimento');
  const showVencimento = meta.datas.includes('vencimento');
  const showCompetencia = meta.datas.includes('competencia');
  const isCartaoDespesa = meta.natureza === 'saida' && (state.formaPagamento === 'cartao_credito' || state.formaPagamento === 'cartao_debito');
  const showRecorrente = meta.natureza === 'saida' && !isCartaoDespesa;

  const hasEssencialSection = showCategoria || showFavorecido || showDescricaoAtivo || showDescricao;
  const hasMaisOpcoes = showRecorrente || showCompetencia;

  const competenciaFilled = state.competencia !== hoje();
  const disclosureFilled = (showCompetencia && competenciaFilled ? 1 : 0) + (showRecorrente && state.isRecorrente ? 1 : 0);

  // Auto-seleciona item padrão para Venda Avulsa
  useEffect(() => {
    if (tipo === 'receita_operacional' && itens.length > 0 && !state.itemId) {
      const itemVenda = itens.find(
        (i: any) => i.nome.toLowerCase() === 'venda avulsa' || i.nome.toLowerCase() === 'vendas avulsas'
      );
      if (itemVenda) {
        setField('itemId', itemVenda.id);
      } else {
        setField('itemId', itens[0].id);
      }
    }
  }, [tipo, itens, state.itemId]);

  const canSubmit = state.valor > 0 && (tipo === 'receita_operacional' || !!state.itemId) && !submitting;

  // ─────────────────────────────────────────────────────────
  // Submit
  // ─────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!canSubmit) return;
    
    // Validação específica para cartão de despesa
    if (isCartaoDespesa && !state.cartaoId) {
      toast({
        title: 'Selecione um cartão',
        description: 'Por favor, selecione qual cartão foi utilizado.',
        variant: 'destructive',
      });
      return;
    }

    // Resolve itemId para Venda Avulsa automaticamente se ainda não estiver definido
    let finalItemId = state.itemId;
    if (tipo === 'receita_operacional' && !finalItemId) {
      const itemVenda = itens.find(
        (i: any) => i.nome.toLowerCase() === 'venda avulsa' || i.nome.toLowerCase() === 'vendas avulsas'
      );
      if (itemVenda) {
        finalItemId = itemVenda.id;
      } else if (itens.length > 0) {
        finalItemId = itens[0].id;
      } else {
        try {
          const novo = await adicionarItemFinanceiro('Venda Avulsa', 'Receita Operacional');
          finalItemId = novo?.id || null;
        } catch {
          finalItemId = null;
        }
      }
    }

    // Compõe observações preservando metadados sem coluna dedicada.
    const partes: string[] = [];
    if (showFavorecido && state.favorecido.trim()) {
      partes.push(`Favorecido: ${state.favorecido.trim()}`);
    }
    if ((showDescricaoAtivo || showDescricao) && state.descricao.trim()) {
      partes.push(state.descricao.trim());
    }
    if (state.formaPagamento && !isCartaoDespesa) {
      const fp = FORMAS_PAGAMENTO.find((f) => f.value === state.formaPagamento);
      if (fp) partes.push(`Forma: ${fp.label}`);
    }
    if (state.observacoes.trim()) partes.push(state.observacoes.trim());
    const observacoes = partes.join(' · ');

    const dataPrimeira =
      state.vencimento ?? state.recebimento ?? state.competencia ?? hoje();

    setSubmitting(true);
    try {
      await createTransactionEngine({
        itemId: finalItemId,
        valorTotal: state.valor,
        dataPrimeiraOcorrencia: dataPrimeira,
        dataCompra: dataPrimeira, // Para cartões, a data de compra será a selecionada em "Quando"
        observacoes,
        pago: state.pago,
        dataPagamento: state.pago ? dataPrimeira : undefined,
        formaPagamento: state.formaPagamento || undefined,
        cartaoCreditoId: isCartaoDespesa ? state.cartaoId : undefined,
        isParcelado: isCartaoDespesa && state.formaPagamento === 'cartao_credito' && state.numeroParcelas > 1,
        numeroDeParcelas: isCartaoDespesa && state.formaPagamento === 'cartao_credito' ? state.numeroParcelas : 1,
        isRecorrente: showRecorrente ? state.isRecorrente : false,
        isValorFixo: state.isValorFixo,
      });
      onCreated?.();
      onClose();
    } catch (e: any) {
      toast({
        title: 'Erro ao registrar lançamento',
        description: e?.message ?? 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  // ─────────────────────────────────────────────────────────
  // Form principal
  // ─────────────────────────────────────────────────────────

  return (
    <motion.div
      key={`form-${tipo}`}
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col min-h-0 flex-1"
    >
      <div className={`flex-1 min-h-0 overflow-y-auto ${isMobile ? 'px-5 py-4' : 'px-6 py-5'}`}>
        {/* Valor — protagonista, com toggle "Pago" ao lado */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CurrencyField
              value={state.valor}
              onChange={(v) => setField('valor', v)}
              autoFocus
            />
          </div>
          <div className="pt-3">
            <PaidToggle
              checked={state.pago}
              onChange={(v) => setField('pago', v)}
              label={meta.natureza === 'entrada' ? 'Recebido' : 'Pago'}
              labelInactive={meta.natureza === 'entrada' ? 'A receber' : 'A pagar'}
            />
          </div>
        </div>

        {/* Essencial */}
        {hasEssencialSection && (
          <>
            <SectionHeader label="Essencial" />
            {showCategoria && (
              <FieldRow label="Categoria" required>
                <SmartSelect
                  value={state.itemId}
                  onChange={(v) => setField('itemId', v)}
                  options={categoriaOptions}
                  placeholder="Escolher categoria"
                  emptyMessage="Nenhuma categoria neste grupo."
                  createNewLabel="Criar categoria"
                  onCreateNew={async (nome) => {
                    try {
                      const novo = await adicionarItemFinanceiro(nome, grupo as any);
                      if (novo?.id) setField('itemId', novo.id);
                    } catch (e: any) {
                      toast({
                        title: 'Não foi possível criar',
                        description: e?.message ?? 'Tente outro nome.',
                        variant: 'destructive',
                      });
                    }
                  }}
                />
              </FieldRow>
            )}

            {showFavorecido && (
              <FieldRow label="Favorecido">
                <TextField
                  value={state.favorecido}
                  onChange={(v) => setField('favorecido', v)}
                  placeholder="Ex.: Coworking Plaza"
                  maxLength={80}
                />
              </FieldRow>
            )}

            {showDescricaoAtivo && (
              <FieldRow label="Ativo">
                <TextField
                  value={state.descricao}
                  onChange={(v) => setField('descricao', v)}
                  placeholder="Ex.: Câmera Sony A7 IV"
                  maxLength={120}
                />
              </FieldRow>
            )}

            {showDescricao && (
              <FieldRow label="Descrição">
                <TextField
                  value={state.descricao}
                  onChange={(v) => setField('descricao', v)}
                  placeholder="Descreva a receita"
                  maxLength={120}
                />
              </FieldRow>
            )}
          </>
        )}

        {/* Quando */}
        <SectionHeader label="Quando" />
        {showRecebimento && (
          <FieldRow label={state.pago ? 'Recebido em' : 'Recebimento'} required>
            <DateField
              value={state.recebimento}
              onChange={(v) => setField('recebimento', v)}
            />
          </FieldRow>
        )}
        {showVencimento && (
          <FieldRow label={state.pago ? 'Pago em' : (isCartaoDespesa ? 'Data da compra' : 'Vencimento')} required>
            <DateField
              value={state.vencimento}
              onChange={(v) => setField('vencimento', v)}
            />
          </FieldRow>
        )}

        {/* Origem / pagamento */}
        <SectionHeader label="Pagamento" />
        <FieldRow label="Forma">
          <SmartSelect
            value={state.formaPagamento}
            onChange={(v) => {
              setField('formaPagamento', v);
              // Ao desmarcar cartão, reseta estado de cartão
              if (v !== 'cartao_credito' && v !== 'cartao_debito') {
                setField('cartaoId', null);
                setField('numeroParcelas', 1);
              } else if (meta.natureza === 'saida') {
                // Desmarca recorrência quando seleciona cartão para despesa
                setField('isRecorrente', false);
              }
            }}
            options={FORMAS_PAGAMENTO}
            placeholder="Não informado"
          />
        </FieldRow>
        
        {isCartaoDespesa && (
          <FieldRow label="Cartão" required>
            <SmartSelect
              value={state.cartaoId}
              onChange={(v) => setField('cartaoId', v)}
              options={cartoesOptions}
              placeholder="Selecionar cartão cadastrado"
              emptyMessage="Nenhum cartão ativo cadastrado."
            />
          </FieldRow>
        )}
        
        {isCartaoDespesa && state.formaPagamento === 'cartao_credito' && (
          <FieldRow label="Parcelas">
            <TextField
              type="number"
              value={state.numeroParcelas.toString()}
              onChange={(v) => {
                const num = parseInt(v);
                if (!isNaN(num) && num > 0) {
                  setField('numeroParcelas', num);
                } else if (v === '') {
                  // Permite apagar temporariamente, mas não salva
                  setState(s => ({...s, numeroParcelas: 0 as any}));
                }
              }}
              placeholder="Ex: 1 para à vista"
            />
          </FieldRow>
        )}

        {/* Observações sempre visíveis */}
        <div className="mt-3">
          <FieldRow label="Observações" align="start">
            <TextAreaField
              value={state.observacoes}
              onChange={(v) => setField('observacoes', v)}
              placeholder="Notas internas (opcional)"
              maxLength={500}
              rows={3}
            />
          </FieldRow>
        </div>

        {/* Mais opções (apenas se houver campos extras como recorrência ou competência) */}
        {hasMaisOpcoes && (
          <div className="mt-3">
            <DisclosureSection title="Mais opções" filledCount={disclosureFilled}>
              {showRecorrente && (
                <div className="mb-4 space-y-3 rounded-lg border border-border/50 bg-muted/20 p-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="recorrente"
                      checked={state.isRecorrente}
                      onChange={(e) => setField('isRecorrente', e.target.checked)}
                      className="h-4 w-4 rounded border-border text-accent-gold focus:ring-accent-gold"
                    />
                    <label htmlFor="recorrente" className="text-[12.5px] font-medium text-foreground">
                      Despesa recorrente
                    </label>
                  </div>
                  {state.isRecorrente && (
                    <div className="pl-6 space-y-2">
                      <p className="text-[11.5px] text-muted-foreground leading-snug">
                        Gerará lançamentos automáticos para os meses seguintes do ano civil.
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="valorFixo"
                          checked={state.isValorFixo}
                          onChange={(e) => setField('isValorFixo', e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-border text-accent-gold focus:ring-accent-gold"
                        />
                        <label htmlFor="valorFixo" className="text-[12px] text-foreground">
                          O valor é fixo mensalmente (pode ser ajustado depois se variar)
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {showCompetencia && (
                <FieldRow label="Competência" hint="Mês contábil de referência">
                  <DateField
                    value={state.competencia}
                    onChange={(v) => setField('competencia', v)}
                  />
                </FieldRow>
              )}
            </DisclosureSection>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer
        className={`flex items-center gap-2 border-t border-border/40 shrink-0 ${isMobile ? 'justify-stretch px-5 py-3' : 'justify-end px-6 py-4'}`}
        style={isMobile ? { paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' } : undefined}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className={`rounded-md font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50 ${isMobile ? 'flex-1 px-4 py-2.5 text-[13px]' : 'px-3 py-1.5 text-[12px]'}`}
        >
          Cancelar
        </button>
        <motion.button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          whileHover={canSubmit ? { y: -1 } : undefined}
          whileTap={canSubmit ? { scale: 0.97 } : undefined}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className={`inline-flex items-center justify-center gap-1.5 rounded-md bg-accent-gold font-semibold text-background shadow-[0_4px_14px_-4px_rgba(198,163,106,0.45)] hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none ${isMobile ? 'flex-[2] px-4 py-2.5 text-[13px]' : 'px-3.5 py-1.5 text-[12px]'}`}
        >
          <AnimatePresence mode="wait" initial={false}>
            {submitting ? (
              <motion.span
                key="loading"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="inline-flex items-center overflow-hidden"
              >
                <Loader2 className="h-3 w-3 animate-spin" />
              </motion.span>
            ) : null}
          </AnimatePresence>
          <span>{submitting ? 'Salvando…' : 'Salvar lançamento'}</span>
        </motion.button>
      </footer>
    </motion.div>
  );
});

export default LancamentoForm;
