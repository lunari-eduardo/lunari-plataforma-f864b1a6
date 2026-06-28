import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ColumnQuickAddProps {
  onAdd: (title: string) => Promise<void> | void;
}

export default function ColumnQuickAdd({ onAdd }: ColumnQuickAddProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) requestAnimationFrame(() => ref.current?.focus());
  }, [open]);

  const submit = async () => {
    const title = value.trim();
    if (!title || busy) {
      if (!title) setOpen(false);
      return;
    }
    setBusy(true);
    try {
      await onAdd(title);
      setValue('');
      requestAnimationFrame(() => ref.current?.focus());
    } finally {
      setBusy(false);
    }
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape') {
      setValue('');
      setOpen(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'w-full flex items-center justify-center gap-1.5 py-2 rounded-lg',
          'text-xs text-lunar-textSecondary hover:text-lunar-text',
          'hover:bg-foreground/[0.04] transition-colors duration-150'
        )}
      >
        <Plus className="w-3.5 h-3.5" />
        Nova tarefa
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-lunar-accent/40 bg-card/40 dark:bg-card/[0.06] backdrop-blur-xl p-2">
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => { if (!value.trim()) setOpen(false); }}
        placeholder="Escreva a tarefa..."
        disabled={busy}
        className="w-full bg-transparent outline-none text-sm text-lunar-text placeholder:text-lunar-textSecondary"
      />
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-2xs text-lunar-textSecondary opacity-70">Enter cria · Esc cancela</span>
      </div>
    </div>
  );
}
