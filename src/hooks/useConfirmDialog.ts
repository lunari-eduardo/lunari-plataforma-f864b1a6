import { useState } from 'react';

export interface ConfirmDialogOptions {
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'destructive' | 'default';
}

export interface ConfirmDialogState extends ConfirmDialogOptions {
  isOpen: boolean;
  resolve?: (value: boolean) => void;
}

export function useConfirmDialog() {
  const [dialogState, setDialogState] = useState<ConfirmDialogState>({
    isOpen: false,
    description: '',
    title: 'Confirmar ação',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    variant: 'default'
  });

  const confirm = (options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialogState({
        ...options,
        title: options.title || 'Confirmar ação',
        confirmText: options.confirmText || 'Confirmar',
        cancelText: options.cancelText || 'Cancelar',
        variant: options.variant || 'default',
        isOpen: true,
        resolve
      });
    });
  };

  const handleConfirm = () => {
    dialogState.resolve?.(true);
    setDialogState(prev => ({ ...prev, isOpen: false }));
  };

  const handleCancel = () => {
    dialogState.resolve?.(false);
    setDialogState(prev => ({ ...prev, isOpen: false }));
  };

  const handleClose = () => {
    dialogState.resolve?.(false);
    setDialogState(prev => ({ ...prev, isOpen: false }));
  };

  return {
    dialogState,
    confirm,
    handleConfirm,
    handleCancel,
    handleClose
  };
}