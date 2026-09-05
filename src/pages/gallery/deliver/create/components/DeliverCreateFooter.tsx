import { ArrowLeft, ArrowRight, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DeliverCreateFooterProps {
  currentStep: number;
  stepsCount: number;
  isCreatingGallery: boolean;
  isUploading: boolean;
  isPublishing: boolean;
  photoCount: number;
  uploadedPhotosCount: number;
  onBack: () => void;
  onNext: () => void;
  onPublish: () => void;
}

export function DeliverCreateFooter({
  currentStep,
  stepsCount,
  isCreatingGallery,
  isUploading,
  isPublishing,
  photoCount,
  uploadedPhotosCount,
  onBack,
  onNext,
  onPublish,
}: DeliverCreateFooterProps) {
  return (
    <div className="fixed bottom-0 left-0 md:left-16 right-0 border-t bg-background/95 backdrop-blur z-40 shadow-[0_-4px_16px_rgba(0,0,0,0.03)]">
      <div className="max-w-[79rem] mx-auto w-full px-3 sm:px-4 lg:px-6 py-4 flex justify-between items-center gap-2">
        <Button
          variant="outline"
          onClick={onBack}
          className="active:scale-[0.98] transition-all rounded-xl"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {currentStep === 1 ? 'Cancelar' : 'Voltar'}
        </Button>

        {currentStep < stepsCount ? (
          <Button
            onClick={onNext}
            disabled={isCreatingGallery || isUploading}
            className="bg-[#cbb384] hover:bg-[#bfa574] text-white active:scale-[0.98] transition-all rounded-xl shadow-sm font-medium"
          >
            {isCreatingGallery ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Criando galeria...
              </>
            ) : (
              <>
                Próximo
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={onPublish}
            disabled={isPublishing || (photoCount === 0 && uploadedPhotosCount === 0)}
            className="bg-[#cbb384] hover:bg-[#bfa574] text-white gap-2 shadow-md active:scale-[0.98] transition-all rounded-xl font-medium"
          >
            {isPublishing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Publicando entrega...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Publicar Entrega
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
