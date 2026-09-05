import { useState } from 'react';
import { toast } from 'sonner';
import { DiscountPreset, DiscountPackage } from '@/types/gallery';
import { generateId } from '@/lib/storage';

interface UseDiscountPresetsProps {
  settings: any;
  discountPackages: DiscountPackage[];
  setDiscountPackages: (packages: DiscountPackage[]) => void;
  createDiscountPreset: any;
  updateDiscountPreset: any;
  deleteDiscountPreset: any;
}

export function useDiscountPresets({
  settings,
  discountPackages,
  setDiscountPackages,
  createDiscountPreset,
  updateDiscountPreset,
  deleteDiscountPreset,
}: UseDiscountPresetsProps) {
  const [showSavePresetDialog, setShowSavePresetDialog] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [renamingPreset, setRenamingPreset] = useState<DiscountPreset | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);

  const savePreset = () => {
    const trimmed = presetName.trim();
    if (!trimmed) {
      toast.error('Digite um nome para a predefinição');
      return;
    }
    const existing = settings.discountPresets || [];
    if (existing.some((p: DiscountPreset) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Já existe uma predefinição com esse nome');
      return;
    }
    createDiscountPreset(
      { name: trimmed, packages: discountPackages },
      {
        onSuccess: () => {
          toast.success('Predefinição salva');
          setPresetName('');
          setShowSavePresetDialog(false);
        },
        onError: () => {
          toast.error('Erro ao salvar predefinição');
        },
      } as any
    );
  };

  const loadPreset = (presetId: string) => {
    const preset = settings.discountPresets?.find((p: DiscountPreset) => p.id === presetId);
    if (preset) {
      const clonedPackages = preset.packages.map((pkg: DiscountPackage) => ({
        ...pkg,
        id: generateId(),
      }));
      setDiscountPackages(clonedPackages);
      toast.success(`Predefinição "${preset.name}" carregada`);
    }
  };

  const renamePreset = () => {
    if (!renamingPreset) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      toast.error('Digite um nome');
      return;
    }
    const others = (settings.discountPresets || []).filter((p: DiscountPreset) => p.id !== renamingPreset.id);
    if (others.some((p: DiscountPreset) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Já existe uma predefinição com esse nome');
      return;
    }
    updateDiscountPreset(
      { ...renamingPreset, name: trimmed },
      {
        onSuccess: () => {
          toast.success('Predefinição renomeada');
          setRenamingPreset(null);
          setRenameValue('');
        },
        onError: () => toast.error('Erro ao renomear'),
      } as any
    );
  };

  const confirmDeletePreset = () => {
    if (!deletingPresetId) return;
    deleteDiscountPreset(deletingPresetId, {
      onSuccess: () => {
        toast.success('Predefinição excluída');
        setDeletingPresetId(null);
      },
      onError: () => toast.error('Erro ao excluir'),
    } as any);
  };

  return {
    showSavePresetDialog,
    setShowSavePresetDialog,
    presetName,
    setPresetName,
    renamingPreset,
    setRenamingPreset,
    renameValue,
    setRenameValue,
    deletingPresetId,
    setDeletingPresetId,
    savePreset,
    loadPreset,
    renamePreset,
    confirmDeletePreset,
  };
}
