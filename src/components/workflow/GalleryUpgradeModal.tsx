import { useNavigate } from "react-router-dom";
import { Image, Crown } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface GalleryUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GalleryUpgradeModal({ isOpen, onClose }: GalleryUpgradeModalProps) {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    onClose();
    navigate('/escolher-plano');
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Image className="h-8 w-8 text-primary" />
            </div>
          </div>
          <AlertDialogTitle className="text-center">
            Funcionalidade exclusiva PRO + Gallery
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            A criação de galerias está disponível apenas para assinantes do plano{" "}
            <strong className="text-foreground">PRO + Gallery</strong>. 
            <br /><br />
            Faça upgrade para desbloquear esta funcionalidade e permitir que seus 
            clientes selecionem fotos online de forma profissional.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel className="w-full sm:w-auto">
            Fechar
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleUpgrade}
            className="w-full sm:w-auto"
          >
            <Crown className="mr-2 h-4 w-4" />
            Ver Planos
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
