import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, Trash2 } from 'lucide-react';
import { useImageUpload } from '@/hooks/user-profile/useImageUpload';

interface LogoUploadSectionProps {
  logoUrl?: string;
  logoFileName?: string;
  onLogoSave: (logoUrl: string, fileName: string) => void;
  onLogoRemove: () => void;
}

export function LogoUploadSection({ 
  logoUrl, 
  logoFileName, 
  onLogoSave, 
  onLogoRemove 
}: LogoUploadSectionProps) {
  const { handleFileUpload, isUploading } = useImageUpload({
    onSuccess: onLogoSave,
    maxSize: 5 * 1024 * 1024, // 5MB
    accept: 'image/*'
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Logotipo da Empresa</h3>
        <p className="text-sm text-lunar-textSecondary mb-4">
          Adicione o logotipo da sua empresa. Recomendamos imagens em formato PNG ou JPG com fundo transparente.
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
                    {logoFileName || 'Arquivo enviado'}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={onLogoRemove}>
                  <Trash2 className="h-4 w-4 mr-1" />
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
                <Upload className="h-4 w-4 mr-2" />
                {isUploading ? 'Enviando...' : (logoUrl ? 'Trocar Logo' : 'Enviar Logo')}
              </span>
            </Button>
          </label>
          <input 
            id="logo-upload" 
            type="file" 
            accept="image/*" 
            onChange={handleFileUpload} 
            className="hidden" 
          />
        </div>

        <div className="text-xs text-lunar-textSecondary space-y-1">
          <p>• Formatos aceitos: PNG, JPG, JPEG</p>
          <p>• Tamanho máximo: 5MB</p>
          <p>• Recomendado: 512x512px ou superior</p>
        </div>
      </div>
    </div>
  );
}