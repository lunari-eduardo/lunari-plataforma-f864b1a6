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
    { number: 4, label: 'Cidade' }
  ];

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <React.Fragment key={step.number}>
            {/* Círculo da Etapa */}
            <div className="flex flex-col items-center">
              <div 
                className={`
                  w-8 h-8 md:w-10 md:h-10 rounded-full border-2 flex items-center justify-center
                  transition-all duration-300
                  ${step.number <= currentStep 
                    ? 'bg-[#CD7F5E] border-[#CD7F5E] text-white' 
                    : 'bg-white/20 border-white/30 text-white/60'
                  }
                `}
              >
                {step.number < currentStep ? (
                  <Check className="w-4 h-4 md:w-5 md:h-5" />
                ) : (
                  <span className="text-xs md:text-sm font-light">{step.number}</span>
                )}
              </div>
              <span 
                className={`
                  mt-2 text-xs font-light hidden sm:block
                  ${step.number <= currentStep ? 'text-[#CD7F5E]' : 'text-white/60'}
                `}
              >
                {step.label}
              </span>
            </div>
            
            {/* Linha Conectora */}
            {index < steps.length - 1 && (
              <div 
                className={`
                  flex-1 h-[2px] mx-1 md:mx-2
                  transition-all duration-300
                  ${step.number < currentStep ? 'bg-[#CD7F5E]' : 'bg-white/30'}
                `}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
