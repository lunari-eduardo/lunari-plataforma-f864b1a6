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
import { useRunCapability } from '@/shared/capability/react';
import {
  getLancamentoTipoMeta,
  isCampoPermitido,
  type LancamentoTipo,
  type OrigemReceitaOperacional,
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
import { markTransactionPaid } from '@/modules/finance';



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
  observacoes: string;
}

function initialState(): FormState {
  return {
    valor: 0,
    itemId: null,
    favorecido: '',
    descricao: '',
    competencia: hoje(),
    vencimento: hoje(),
    recebimento: hoje(),
    formaPagamento: null,
    observacoes: '',
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
  /** Callback opcional: quando o usuário escolhe "Venda avulsa" no pré-form. */
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

  // Pré-form contextual (Receita Operacional → origem)
  const [origem, setOrigem] = useState<OrigemReceitaOperacional | null>(null);
  const precisaOrigem = tipo === 'receita_operacional' && !origem;

  const [state, setState] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // reset quando muda o tipo
    setState(initialState());
    setOrigem(null);
  }, [tipo]);

  const grupo = meta.gruposPermitidos[0];
  const itens = obterItensPorGrupo(grupo as any);
  const categoriaOptions = useMemo<SmartSelectOption[]>(
    () => itens.map((i: any) => ({ value: i.id, label: i.nome })),
    [itens],
  );

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const showFavorecido = isCampoPermitido(tipo, 'favorecido') && meta.natureza === 'saida';
  const showDescricaoAtivo = tipo === 'investimento';
  const showDescricao = tipo === 'receita_nao_operacional';
  const showRecebimento = meta.datas.includes('recebimento');
  const showVencimento = meta.datas.includes('vencimento');
  const showCompetencia = meta.datas.includes('competencia');

  const observacoesFilled = state.observacoes.trim().length > 0;
  const competenciaFilled = state.competencia !== hoje();
  const disclosureFilled = (observacoesFilled ? 1 : 0) + (competenciaFilled ? 1 : 0);

  const canSubmit = state.valor > 0 && !!state.itemId && !submitting;

  // ─────────────────────────────────────────────────────────
  // Submit
  // ─────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!canSubmit) return;

    // Compõe observações preservando metadados sem coluna dedicada.
    const partes: string[] = [];
    if (showFavorecido && state.favorecido.trim()) {
      partes.push(`Favorecido: ${state.favorecido.trim()}`);
    }
    if ((showDescricaoAtivo || showDescricao) && state.descricao.trim()) {
      partes.push(state.descricao.trim());
    }
    if (state.formaPagamento) {
      const fp = FORMAS_PAGAMENTO.find((f) => f.value === state.formaPagamento);
      if (fp) partes.push(`Forma: ${fp.label}`);
    }
    if (origem) {
      partes.push(`Origem: ${origem.replace('_', ' ')}`);
    }
    if (state.observacoes.trim()) partes.push(state.observacoes.trim());
    const observacoes = partes.join(' · ');

    const dataPrimeira =
      state.vencimento ?? state.recebimento ?? state.competencia ?? hoje();

    setSubmitting(true);
    try {
      await createTransactionEngine({
        itemId: state.itemId,
        valorTotal: state.valor,
        dataPrimeiraOcorrencia: dataPrimeira,
        observacoes,
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
  // Pré-form: Origem da receita operacional
  // ─────────────────────────────────────────────────────────

  if (precisaOrigem && meta.contextoPreForm) {
    const ctx = meta.contextoPreForm;
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="preform"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="contents"
        >
          <div className={`flex-1 min-h-0 overflow-y-auto ${isMobile ? 'px-5 py-5' : 'px-6 py-6'}`}>
            <p className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground mb-3">
              {ctx.label}
            </p>
            <div className="grid gap-2">
              {ctx.opcoes.map((op, i) => {
                const Icon = op.icone;
                return (
                  <motion.button
                    key={op.id}
                    type="button"
                    onClick={() => {
                      if (op.id === 'venda_avulsa') {
                        onSelectVendaAvulsa?.();
                        return;
                      }
                      setOrigem(op.id);
                    }}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: 0.04 * i, ease: 'easeOut' }}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.985 }}
                    className="group flex items-start gap-3 rounded-xl border border-border/60 bg-background p-3 text-left transition-colors hover:border-accent-gold/60 hover:bg-accent-gold/5"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-gold/10 text-accent-gold shrink-0">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-foreground">{op.label}</div>
                      <div className="text-[11.5px] text-muted-foreground leading-snug">
                        {op.descricao}
                      </div>
                    </div>
                  </motion.button>
                );
              })}

            </div>
          </div>
          <footer
            className={`flex items-center justify-end gap-2 border-t border-border/40 shrink-0 ${isMobile ? 'px-5 py-3' : 'px-6 py-4'}`}
            style={isMobile ? { paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' } : undefined}
          >
            <button
              type="button"
              onClick={onClose}
              className={`rounded-md font-medium text-muted-foreground transition-colors hover:text-foreground ${isMobile ? 'px-4 py-2 text-[13px]' : 'px-3 py-1.5 text-[12px]'}`}
            >
              Cancelar
            </button>
          </footer>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ─────────────────────────────────────────────────────────
  // Form principal
  // ─────────────────────────────────────────────────────────

  return (
    <motion.div
      key={`form-${tipo}-${origem ?? 'none'}`}
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col min-h-0 flex-1"
    >
      <div className={`flex-1 min-h-0 overflow-y-auto ${isMobile ? 'px-5 py-4' : 'px-6 py-5'}`}>
        {/* Valor — protagonista */}
        <CurrencyField
          value={state.valor}
          onChange={(v) => setField('valor', v)}
          autoFocus
        />



        {/* Essencial */}
        <SectionHeader label="Essencial" />
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

        {/* Quando */}
        <SectionHeader label="Quando" />
        {showRecebimento && (
          <FieldRow label="Recebimento" required>
            <DateField
              value={state.recebimento}
              onChange={(v) => setField('recebimento', v)}
            />
          </FieldRow>
        )}
        {showVencimento && (
          <FieldRow label="Vencimento" required>
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
            onChange={(v) => setField('formaPagamento', v)}
            options={FORMAS_PAGAMENTO}
            placeholder="Não informado"
          />
        </FieldRow>

        {/* Mais opções */}
        <div className="mt-3">
          <DisclosureSection title="Mais opções" filledCount={disclosureFilled}>
            {showCompetencia && (
              <FieldRow label="Competência" hint="Mês contábil de referência">
                <DateField
                  value={state.competencia}
                  onChange={(v) => setField('competencia', v)}
                />
              </FieldRow>
            )}
            <FieldRow label="Observações" align="start">
              <TextAreaField
                value={state.observacoes}
                onChange={(v) => setField('observacoes', v)}
                placeholder="Notas internas (opcional)"
                maxLength={500}
                rows={3}
              />
            </FieldRow>
          </DisclosureSection>
        </div>
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
