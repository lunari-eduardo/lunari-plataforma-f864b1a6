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
      <div className="space-y-1.5 text-left">
        <h2 className="text-2xl md:text-[28px] font-normal text-white tracking-tight leading-snug">{title}</h2>
        {subtitle && <p className="text-neutral-400 text-sm font-normal">{subtitle}</p>}
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
            className="text-xs text-red-400 text-left font-light"
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
