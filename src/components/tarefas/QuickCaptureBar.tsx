import { useState, useRef, KeyboardEvent } from 'react';
import { Lightbulb, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickCaptureBarProps {
  onCapture: (title: string) => Promise<void> | void;
  placeholder?: string;
}

export default function QuickCaptureBar({ onCapture, placeholder = 'Capturar tarefa ou ideia...' }: QuickCaptureBarProps) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const submit = async () => {
    const title = value.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      await onCapture(title);
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
      ref.current?.blur();
    }
  };

  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-xl px-4 py-2.5',
        'bg-card/30 dark:bg-card/[0.04] backdrop-blur-xl',
        'border border-white/35 dark:border-white/[0.08]',
        'focus-within:border-lunar-accent/60 focus-within:ring-2 focus-within:ring-lunar-accent/15',
        'transition-all duration-200'
      )}
    >
      <Lightbulb className="w-4 h-4 text-lunar-accent flex-shrink-0 opacity-80" />
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        disabled={busy}
        className="flex-1 bg-transparent outline-none text-sm text-lunar-text placeholder:text-lunar-textSecondary disabled:opacity-60"
      />
      {busy ? (
        <Loader2 className="w-4 h-4 text-lunar-textSecondary animate-spin" />
      ) : (
        <span className="text-2xs text-lunar-textSecondary opacity-60 hidden md:inline">
          Enter para criar
        </span>
      )}
    </div>
  );
}
