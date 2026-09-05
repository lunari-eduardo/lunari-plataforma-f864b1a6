import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export const PAYMENT_STEPS = [
  { key: 'personal', label: 'Dados' },
  { key: 'payment', label: 'Pagamento' },
  { key: 'review', label: 'Revisão' },
] as const;

interface StepIndicatorProps {
  currentStep: number;
  completedSteps: number[];
}

export function StepIndicator({ currentStep, completedSteps }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {PAYMENT_STEPS.map((step, i) => {
        const isActive = i === currentStep;
        const isCompleted = completedSteps.includes(i);
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all border-2',
                  isCompleted
                    ? 'bg-primary border-primary text-primary-foreground'
                    : isActive
                      ? 'border-primary text-primary bg-primary/10'
                      : 'border-muted-foreground/30 text-muted-foreground bg-muted/30'
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  'text-xs font-medium',
                  isActive || isCompleted ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </div>
            {i < PAYMENT_STEPS.length - 1 && (
              <div
                className={cn(
                  'w-12 md:w-20 h-0.5 mx-2 mb-5 rounded-full transition-all',
                  isCompleted ? 'bg-primary' : 'bg-muted-foreground/20'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
