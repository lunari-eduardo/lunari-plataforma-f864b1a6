import { cn } from '@/lib/utils';

interface ChargeMethodCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export function ChargeMethodCard({
  icon,
  title,
  description,
  selected,
  onClick,
  disabled = false,
}: ChargeMethodCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all min-h-[90px] w-full',
        'hover:border-primary/50 hover:bg-primary/5',
        selected && 'border-primary bg-primary/10',
        !selected && 'border-border bg-background',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <div className={cn(
        'mb-2 p-2 rounded-full',
        selected ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
      )}>
        {icon}
      </div>
      <span className={cn(
        'text-sm font-medium',
        selected ? 'text-primary' : 'text-foreground'
      )}>
        {title}
      </span>
      <span className="text-xs text-muted-foreground text-center mt-1">
        {description}
      </span>
    </button>
  );
}
