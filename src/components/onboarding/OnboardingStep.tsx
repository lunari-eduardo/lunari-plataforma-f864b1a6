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
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-lunar-accent/10 flex items-center justify-center">
          <Icon className="w-8 h-8 text-lunar-accent" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-lunar-text">
            {title}
          </h2>
          {subtitle && (
            <p className="text-lunar-muted text-sm">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="step-input" className="sr-only">
          {title}
        </Label>
        <Input
          id="step-input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="text-center text-lg h-12"
        />
        {error && (
          <p className="text-sm text-red-500 text-center">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
