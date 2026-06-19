import React from 'react';
import { LucideIcon } from 'lucide-react';
import { AuthInput } from '@/components/auth/AuthInput';

interface OnboardingStepProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
  autoFocus?: boolean;
}

export function OnboardingStep({
  title,
  subtitle,
  icon,
  value,
  onChange,
  placeholder,
  error,
  autoFocus = false,
}: OnboardingStepProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col items-center text-center space-y-2">
        <h2 className="text-xl md:text-2xl font-light text-white tracking-wide">{title}</h2>
        {subtitle && <p className="text-white/60 text-sm font-light">{subtitle}</p>}
      </div>

      <div className="space-y-2">
        <AuthInput
          icon={icon}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          aria-invalid={!!error}
          aria-describedby={error ? 'onboarding-step-error' : undefined}
        />
        {error && (
          <p
            id="onboarding-step-error"
            role="alert"
            aria-live="polite"
            className="text-xs text-red-400 text-center font-light"
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
