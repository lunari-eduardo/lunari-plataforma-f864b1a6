import { format } from 'date-fns';

interface CurrentTimeIndicatorProps {
  now: Date;
  /** Position percentage 0-100 relative to parent (used in 'absolute' mode). */
  topPercent?: number;
  /** Whether to show the leading dot. */
  showDot?: boolean;
  /** Whether to span the full width (week) or only current column. */
  variant?: 'day' | 'week';
}

/**
 * Renders the orange "now" line, Google-Calendar style.
 * Must be placed inside a `position: relative` container.
 */
export default function CurrentTimeIndicator({
  now,
  topPercent = 0,
  showDot = true,
  variant = 'day',
}: CurrentTimeIndicatorProps) {
  return (
    <div
      role="separator"
      aria-label={`Horário atual ${format(now, 'HH:mm')}`}
      className="pointer-events-none absolute left-0 right-0 z-20"
      style={{ top: `${topPercent}%` }}
    >
      <div className="relative flex items-center">
        {showDot && (
          <div
            className="absolute -left-1.5 h-3 w-3 rounded-full shadow-md ring-2 ring-background"
            style={{ backgroundColor: 'hsl(var(--time-now))' }}
          />
        )}
        <div
          className="h-[2px] w-full"
          style={{
            backgroundColor: 'hsl(var(--time-now))',
            boxShadow: '0 0 6px hsl(var(--time-now) / 0.5)',
            opacity: variant === 'week' ? 0.95 : 1,
          }}
        />
        <div
          className="absolute -top-2.5 left-3 rounded px-1 py-0.5 text-[9px] font-semibold tabular-nums"
          style={{ color: 'hsl(var(--time-now))' }}
        >
          {format(now, 'HH:mm')}
        </div>
      </div>
    </div>
  );
}
