import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface LogoUploadSectionProps {
  logoUrl?: string;
  onLogoSave: (file: File) => Promise<void>;
  onLogoRemove: () => Promise<void>;
}

export function LogoUploadSection({ 
  logoUrl, 
  onLogoSave, 
  onLogoRemove 
}: LogoUploadSectionProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Tipo de arquivo inválido. Apenas JPG, PNG e WEBP são permitidos.');
      return;
    }

    // Validar tamanho (5MB max)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error('Arquivo muito grande. Tamanho máximo: 5MB');
      return;
    }

    setIsUploading(true);
    try {
      await onLogoSave(file);
    } finally {
      setIsUploading(false);
      // Reset input
      event.target.value = '';
    }
  };

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      await onLogoRemove();
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Logotipo da Empresa</h3>
        <p className="text-sm text-lunar-textSecondary mb-4">
          Adicione o logotipo da sua empresa. Este logo será exibido apenas para você na navegação do sistema.
        </p>
      </div>

      <div className="space-y-4">
        {logoUrl ? (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-lunar-surface rounded-lg flex items-center justify-center overflow-hidden">
                  <img 
                    src={logoUrl} 
                    alt="Logo da empresa" 
                    className="max-w-full max-h-full object-contain" 
                  />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Logo atual</p>
                  <p className="text-sm text-lunar-textSecondary">
                    Clique em "Trocar Logo" para substituir
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleRemove}
                  disabled={isRemoving}
                >
                  {isRemoving ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-1" />
                  )}
                  Remover
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="border-2 border-dashed border-lunar-border rounded-lg p-8 text-center">
            <Upload className="h-12 w-12 text-lunar-textSecondary mx-auto mb-4" />
            <p className="text-lunar-textSecondary mb-4">Nenhum logo enviado</p>
          </div>
        )}

        <div className="flex justify-center">
          <label htmlFor="logo-upload">
            <Button variant="outline" asChild disabled={isUploading}>
              <span className="cursor-pointer">
                {isUploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {isUploading ? 'Enviando...' : (logoUrl ? 'Trocar Logo' : 'Enviar Logo')}
              </span>
            </Button>
          </label>
          <input 
            id="logo-upload" 
            type="file" 
            accept="image/jpeg,image/png,image/webp" 
            onChange={handleFileChange} 
            className="hidden" 
          />
        </div>

        <div className="text-xs text-lunar-textSecondary space-y-1">
          <p>• Formatos aceitos: PNG, JPG, WEBP</p>
          <p>• Tamanho máximo: 5MB</p>
          <p>• Recomendado: 512x512px ou superior</p>
        </div>
      </div>
    </div>
  );
}
