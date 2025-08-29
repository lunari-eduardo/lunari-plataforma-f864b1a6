import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConfirmDialogState } from '@/hooks/useConfirmDialog';

interface ConfirmDialogProps {
  state: ConfirmDialogState;
  onConfirm: () => void;
  onCancel: () => void;
  onClose: () => void;
}

export function ConfirmDialog({ state, onConfirm, onCancel, onClose }: ConfirmDialogProps) {
  const getIcon = () => {
    switch (state.variant) {
      case 'destructive':
        return <Trash2 className="h-5 w-5 text-destructive" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-lunar-warning" />;
    }
  };

  return (
    <AlertDialog open={state.isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="sm:max-w-[425px] bg-lunar-surface border border-lunar-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-lunar-text">
            {getIcon()}
            {state.title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-lunar-textSecondary">
            {state.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel 
            onClick={onCancel}
            className="bg-lunar-surface border-lunar-border text-lunar-text hover:bg-lunar-border/50"
          >
            {state.cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={cn(
              "text-white font-medium",
              state.variant === 'destructive'
                ? "bg-destructive hover:bg-destructive/90"
                : "bg-primary hover:bg-primary/90"
            )}
          >
            {state.confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}