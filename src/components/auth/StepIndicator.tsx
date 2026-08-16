import React from 'react';
import { Check } from 'lucide-react';

interface StepIndicatorProps {
  currentStep: 1 | 2 | 3 | 4;
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const steps = [
    { number: 1, label: 'Conta' },
    { number: 2, label: 'Nome' },
    { number: 3, label: 'Nicho' },
    { number: 4, label: 'Cidade' },
  ];

  return (
    <div className="w-full pb-2">
      <div className="flex items-center">
        {steps.map((step, index) => {
          const isComplete = step.number < currentStep;
          const isActive = step.number === currentStep;

          return (
            <React.Fragment key={step.number}>
              <div className="flex flex-col items-center shrink-0">
                <div
                  className={`
                    w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center
                    transition-all duration-300
                    ${
                      isComplete
                        ? 'bg-[#C6A36A] border border-[#C6A36A] text-[#121212]'
                        : isActive
                        ? 'bg-transparent border border-[#C6A36A] text-[#E4CFA8]'
                        : 'bg-transparent border border-white/15 text-white/40'
                    }
                  `}
                >
                  {isComplete ? (
                    <Check className="w-4 h-4 text-[#121212]" strokeWidth={2.5} />
                  ) : (
                    <span className="text-xs md:text-sm font-medium">{step.number}</span>
                  )}
                </div>
                <span
                  className={`
                    mt-2 text-[11px] font-normal tracking-wide
                    ${isComplete || isActive ? 'text-[#D4A560]' : 'text-white/40'}
                  `}
                >
                  {step.label}
                </span>
              </div>

              {index < steps.length - 1 && (
                <div className="flex-1 mx-2 self-start mt-4 md:mt-4.5">
                  <div
                    className={`
                      h-[1px] w-full rounded-full transition-all duration-500
                      ${step.number < currentStep ? 'bg-[#C6A36A]' : 'bg-white/10'}
                    `}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

