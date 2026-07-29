/**
 * PaidToggle — Toggle "Pago" ao lado do valor no LancamentoForm.
 * Silent Luxury: pill compacto, dourado quando ativo, contorno neutro inativo.
 */
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  /** Rótulo curto exibido dentro do pill. */
  label?: string;
  /** Rótulo alternativo quando inativo. */
  labelInactive?: string;
}

export function PaidToggle({
  checked,
  onChange,
  label = 'Pago',
  labelInactive,
}: Props) {
  const text = checked ? label : labelInactive ?? label;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={[
        'group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors select-none',
        checked
          ? 'border-accent-gold/60 bg-accent-gold/12 text-accent-gold shadow-[0_2px_10px_-4px_rgba(198,163,106,0.45)]'
          : 'border-border/60 bg-transparent text-muted-foreground hover:border-accent-gold/40 hover:text-foreground',
      ].join(' ')}
    >
      <span
        className={[
          'flex h-3.5 w-3.5 items-center justify-center rounded-full transition-colors',
          checked
            ? 'bg-accent-gold text-background'
            : 'bg-muted/60 text-transparent',
        ].join(' ')}
      >
        <motion.span
          initial={false}
          animate={{ scale: checked ? 1 : 0.4, opacity: checked ? 1 : 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="flex"
        >
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
        </motion.span>
      </span>
      <span>{text}</span>
    </button>
  );
}

export default PaidToggle;
