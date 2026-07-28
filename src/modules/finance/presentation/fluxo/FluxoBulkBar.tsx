import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Trash2, X } from 'lucide-react';

interface FluxoBulkBarProps {
  count: number;
  onClear: () => void;
  onMarkPaid: () => void;
  onDelete: () => void;
}

const FluxoBulkBar = memo(function FluxoBulkBar({ count, onClear, onMarkPaid, onDelete }: FluxoBulkBarProps) {
  if (count === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background border border-border shadow-lg rounded-xl px-4 py-2 flex items-center gap-3">
      <span className="text-sm font-medium">{count} selecionados</span>
      <div className="h-4 w-px bg-border" />
      <Button variant="ghost" size="sm" onClick={onMarkPaid} className="gap-1.5">
        <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
        Marcar pago
      </Button>
      <Button variant="ghost" size="sm" onClick={onDelete} className="gap-1.5 text-destructive hover:text-destructive">
        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
        Excluir
      </Button>
      <div className="h-4 w-px bg-border" />
      <Button variant="ghost" size="icon" onClick={onClear} className="h-8 w-8">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
});

export default FluxoBulkBar;
