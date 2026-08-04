import { ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuthButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: 'primary' | 'outline';
}

export const AuthButton = forwardRef<HTMLButtonElement, AuthButtonProps>(
  ({ loading, variant = 'primary', className, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'w-full h-12 rounded-xl font-medium text-sm transition-all duration-150',
          'flex items-center justify-center gap-2',
          'disabled:opacity-60 disabled:cursor-not-allowed',
          variant === 'primary' &&
            'bg-gradient-to-b from-[#C9A87C] to-[#9A7F52] text-white shadow-[0_8px_24px_-8px_rgba(201,168,124,0.4)] hover:from-[#D4B892] hover:to-[#A88B5D] active:scale-[0.99]',
          variant === 'outline' &&
            'bg-white/[0.04] border border-white/10 text-white hover:bg-white/[0.08]',
          className,
        )}
        {...props}
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : children}
      </button>
    );
  },
);
AuthButton.displayName = 'AuthButton';
