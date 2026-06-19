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
    <div className="w-full px-2 pb-2">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isComplete = step.number < currentStep;
          const isActive = step.number === currentStep;
          const isReached = step.number <= currentStep;

          return (
            <React.Fragment key={step.number}>
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-8 h-8 md:w-9 md:h-9 rounded-full border flex items-center justify-center
                    transition-all duration-300
                    ${
                      isReached
                        ? 'bg-[#C97A4A] border-[#C97A4A] text-white shadow-[0_4px_14px_-4px_rgba(201,122,74,0.6)]'
                        : 'bg-white/[0.04] border-white/15 text-white/50'
                    }
                  `}
                >
                  {isComplete ? (
                    <Check className="w-4 h-4" strokeWidth={2.5} />
                  ) : (
                    <span className="text-xs md:text-sm font-medium">{step.number}</span>
                  )}
                </div>
                <span
                  className={`
                    mt-2 text-[11px] font-light tracking-wide hidden sm:block
                    ${isActive ? 'text-[#C97A4A]' : isReached ? 'text-white/80' : 'text-white/40'}
                  `}
                >
                  {step.label}
                </span>
              </div>

              {index < steps.length - 1 && (
                <div
                  className={`
                    flex-1 h-[2px] mx-1 md:mx-2 rounded-full
                    transition-all duration-500
                    ${isComplete ? 'bg-[#C97A4A]' : 'bg-white/10'}
                  `}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
