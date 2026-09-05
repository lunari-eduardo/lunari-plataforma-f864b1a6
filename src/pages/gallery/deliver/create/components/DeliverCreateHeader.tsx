import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DELIVER_STEPS } from '../types';

interface DeliverCreateHeaderProps {
  currentStep: number;
}

export function DeliverCreateHeader({ currentStep }: DeliverCreateHeaderProps) {
  const navigate = useNavigate();

  return (
    <>
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/app/gallery/list?tab=transfer')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Nova Entrega</h1>
          <p className="text-muted-foreground text-sm">
            Passo {currentStep} de {DELIVER_STEPS.length} · {DELIVER_STEPS[currentStep - 1]?.name}
          </p>
        </div>
      </div>

      {/* Luxury Step Indicator */}
      <div className="flex items-center justify-between mb-8 overflow-x-auto pb-2 scrollbar-none">
        {DELIVER_STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;
          return (
            <div key={step.id} className="flex items-center">
              <div
                className={cn(
                  'flex items-center gap-2 px-3.5 py-2 rounded-full transition-all duration-300 whitespace-nowrap text-sm',
                  isActive &&
                    'bg-[#ddd1b6]/50 text-[#66502a] dark:text-[#f0e6d2] border border-[#cbb384] ring-2 ring-[#cbb384]/20 shadow-[0_2px_12px_rgba(203,179,132,0.2)] font-semibold',
                  isCompleted &&
                    'bg-[#ddd1b6]/30 text-[#856b3e] dark:text-[#cbb384] border border-[#cbb384]/30 font-medium',
                  !isActive &&
                    !isCompleted &&
                    'text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent'
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4 text-[#cbb384]" />
                ) : (
                  <Icon
                    className={cn(
                      'h-4 w-4 transition-transform duration-200',
                      isActive && 'text-[#cbb384] scale-110'
                    )}
                  />
                )}
                <span className="hidden sm:inline">{step.name}</span>
              </div>
              {index < DELIVER_STEPS.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 w-4 md:w-12 mx-1 md:mx-2 rounded-full transition-colors duration-300',
                    isCompleted ? 'bg-[#cbb384]/60 dark:bg-[#cbb384]/40' : 'bg-border/60'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
