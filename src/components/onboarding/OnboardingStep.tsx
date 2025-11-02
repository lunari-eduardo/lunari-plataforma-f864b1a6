import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
  icon: Icon,
  value,
  onChange,
  placeholder,
  error,
  autoFocus = false
}: OnboardingStepProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col items-center text-center space-y-3">
        <div className="space-y-2">
          <h2 className="text-2xl md:text-3xl font-light text-gray-800">
            {title}
          </h2>
          {subtitle && (
            <p className="text-gray-600 text-sm font-light">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="step-input" className="sr-only">
          {title}
        </Label>
        <div className="relative">
          <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            id="step-input"
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className="pl-12 h-12 bg-white/80 border border-gray-300 focus:border-[#CD7F5E] text-center font-light"
          />
        </div>
        {error && (
          <p className="text-sm text-red-500 text-center font-light">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
