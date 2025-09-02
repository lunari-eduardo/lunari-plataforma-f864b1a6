/**
 * Component for selecting pricing model
 * Handles model selection with confirmation dialog
 */

import { useState } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface PricingModelSelectorProps {
  currentModel: 'fixo' | 'global' | 'categoria';
  onModelChange: (model: 'fixo' | 'global' | 'categoria') => void;
}

export function PricingModelSelector({ currentModel, onModelChange }: PricingModelSelectorProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [novoModelo, setNovoModelo] = useState<'fixo' | 'global' | 'categoria' | null>(null);

  const handleModeloChange = (modelo: 'fixo' | 'global' | 'categoria') => {
    // If same model, do nothing
    if (modelo === currentModel) return;

    // Store new model and show confirmation
    setNovoModelo(modelo);
    setShowConfirmModal(true);
  };

  const confirmarMudanca = () => {
    if (!novoModelo) return;
    
    onModelChange(novoModelo);
    setShowConfirmModal(false);
    setNovoModelo(null);
    toast.success('Modelo de precificação alterado com sucesso!');
  };

  const cancelarMudanca = () => {
    setShowConfirmModal(false);
    setNovoModelo(null);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Modelo de Precificação</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={currentModel} onValueChange={handleModeloChange} className="space-y-4">
            <div className="flex items-start space-x-2">
              <RadioGroupItem value="fixo" id="fixo" className="mt-1" />
              <div className="space-y-1">
                <Label htmlFor="fixo" className="font-medium">
                  Valor Fixo por Pacote
                </Label>
                <p className="text-muted-foreground text-xs">
                  Cada pacote tem seu próprio valor para fotos extras. O valor é configurado individualmente na página de Pacotes.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <RadioGroupItem value="global" id="global" className="mt-1" />
              <div className="space-y-1">
                <Label htmlFor="global" className="font-medium">
                  Tabela Progressiva Global
                </Label>
                <p className="text-muted-foreground text-xs">
                  Uma única tabela de preços progressivos aplicada a todos os pacotes.
                  O preço por foto diminui conforme a quantidade aumenta.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <RadioGroupItem value="categoria" id="categoria" className="mt-1" />
              <div className="space-y-1">
                <Label htmlFor="categoria" className="font-medium">
                  Tabela Progressiva por Categoria
                </Label>
                <p className="text-muted-foreground text-xs">
                  Cada categoria de serviço tem sua própria tabela de preços progressivos.
                  Configure tabelas específicas para Gestante, Newborn, etc.
                </p>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Confirmation Modal */}
      <AlertDialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-sky-950">
              <AlertTriangle className="h-5 w-5" />
              Atenção: Mudança no Modelo de Precificação
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Você está prestes a alterar o seu modelo de cálculo para o valor de fotos extras.
              </p>
              <p>
                Isto significa que, ao editar a quantidade de fotos extras em qualquer projeto que já esteja na tabela do Workflow, o valor será recalculado usando as <strong>NOVAS</strong> regras.
              </p>
              <p>
                Para projetos que já estejam em workflow e que precisam de alteração em quantidade de foto extra, recomendamos que ajuste manualmente o campo 'Valor total de foto' do cliente correspondente para corrigir cálculos.
              </p>
              <p className="font-medium text-foreground">
                Deseja continuar?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelarMudanca}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmarMudanca} className="bg-[#1e254e] text-neutral-50">
              Sim, Entendi e Quero Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}