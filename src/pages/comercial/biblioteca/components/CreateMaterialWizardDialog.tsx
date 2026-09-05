import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, ChevronRight, Loader2 } from 'lucide-react';
import { useCreateMaterialWizard } from '../hooks/useCreateMaterialWizard';
import { StepMethod } from './wizard/StepMethod';
import { StepAiBriefing } from './wizard/StepAiBriefing';
import { StepTemplateGallery } from './wizard/StepTemplateGallery';
import { StepPdfUpload } from './wizard/StepPdfUpload';
import { StepCategory } from './wizard/StepCategory';

interface CreateMaterialWizardDialogProps {
  isOpen: boolean;
  onClose: () => void;
  wizard: ReturnType<typeof useCreateMaterialWizard>;
}

export function CreateMaterialWizardDialog({
  isOpen,
  wizard,
}: CreateMaterialWizardDialogProps) {
  const {
    step,
    setStep,
    selectedCategoria,
    setSelectedCategoria,
    customTitle,
    setCustomTitle,
    creationMethod,
    setCreationMethod,
    selectedDbTemplate,
    setSelectedDbTemplate,
    briefing,
    setBriefing,
    selectedPacoteIds,
    setSelectedPacoteIds,
    aiRefs,
    setAiRefs,
    isUploadingRef,
    addRefImages,
    addRefPdf,
    addRefText,
    fileInputRef,
    selectedPdf,
    setSelectedPdf,
    categorias,
    isLoadingCategorias,
    dbTemplates,
    isLoadingDbTemplates,
    handleCloseModal,
    handleCreate,
    isPendingCreate,
    isGenerating,
    profile,
    pacotes,
  } = wizard;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleCloseModal();
      }}
    >
      <DialogContent className="sm:max-w-[580px]">
        <DialogHeader>
          <DialogTitle className="text-xl">Nova Proposta</DialogTitle>
          <DialogDescription>
            {step === 'method' && 'Escolha como deseja iniciar a criação.'}
            {step === 'template-gallery' && 'Escolha um modelo premium para iniciar.'}
            {step === 'pdf-upload' && 'Faça o upload do seu arquivo PDF estático.'}
            {step === 'ai-briefing' && 'Conte sobre a sessão para a IA escrever a proposta.'}
            {step === 'category' && 'Selecione a categoria para este material comercial.'}
          </DialogDescription>
        </DialogHeader>

        {/* ─── PASSO 1: Escolher Modo de Criação ─── */}
        {step === 'method' && (
          <StepMethod
            creationMethod={creationMethod}
            setCreationMethod={setCreationMethod}
          />
        )}

        {/* ─── PASSO IA: Briefing para geração ─── */}
        {step === 'ai-briefing' && (
          <StepAiBriefing
            onBack={() => setStep('method')}
            selectedCategoria={selectedCategoria}
            setSelectedCategoria={setSelectedCategoria}
            categorias={categorias}
            isLoadingCategorias={isLoadingCategorias}
            customTitle={customTitle}
            setCustomTitle={setCustomTitle}
            briefing={briefing}
            setBriefing={setBriefing}
            profile={profile}
            pacotes={pacotes}
            selectedPacoteIds={selectedPacoteIds}
            setSelectedPacoteIds={setSelectedPacoteIds}
            aiRefs={aiRefs}
            setAiRefs={setAiRefs}
            isUploadingRef={isUploadingRef}
            addRefImages={addRefImages}
            addRefPdf={addRefPdf}
            addRefText={addRefText}
          />
        )}

        {/* ─── PASSO 3: Galeria de Templates do Banco ─── */}
        {step === 'template-gallery' && (
          <StepTemplateGallery
            onBack={() => setStep('method')}
            isLoadingDbTemplates={isLoadingDbTemplates}
            dbTemplates={dbTemplates}
            selectedDbTemplate={selectedDbTemplate}
            setSelectedDbTemplate={setSelectedDbTemplate}
          />
        )}

        {/* ─── PASSO 3B: Upload de PDF ─── */}
        {step === 'pdf-upload' && (
          <StepPdfUpload
            onBack={() => setStep('method')}
            selectedPdf={selectedPdf}
            setSelectedPdf={setSelectedPdf}
            fileInputRef={fileInputRef}
          />
        )}

        {/* ─── PASSO FINAL: Selecionar Categoria ─── */}
        {step === 'category' && (
          <StepCategory
            onBack={() => {
              if (creationMethod === 'db-template') setStep('template-gallery');
              else if (creationMethod === 'pdf') setStep('pdf-upload');
              else if (creationMethod === 'ai') setStep('ai-briefing');
              else setStep('method');
            }}
            categorias={categorias}
            isLoadingCategorias={isLoadingCategorias}
            selectedCategoria={selectedCategoria}
            setSelectedCategoria={setSelectedCategoria}
            customTitle={customTitle}
            setCustomTitle={setCustomTitle}
            onSubmit={handleCreate}
          />
        )}

        <DialogFooter className="border-t pt-4">
          <Button variant="ghost" onClick={handleCloseModal}>
            Cancelar
          </Button>

          {step === 'method' && (
            <Button
              onClick={() => {
                if (creationMethod === 'db-template') setStep('template-gallery');
                else if (creationMethod === 'pdf') setStep('pdf-upload');
                else if (creationMethod === 'ai') setStep('ai-briefing');
                else setStep('category');
              }}
              disabled={!creationMethod}
              className="gap-2"
            >
              Continuar
              <ChevronRight size={16} />
            </Button>
          )}

          {step === 'ai-briefing' && (
            <Button
              onClick={handleCreate}
              disabled={!selectedCategoria || isPendingCreate || isGenerating}
              className="gap-2"
            >
              {isPendingCreate || isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isGenerating ? 'Gerando com IA…' : isPendingCreate ? 'Criando…' : 'Gerar e Criar'}
            </Button>
          )}

          {step === 'template-gallery' && (
            <Button
              onClick={() => setStep('category')}
              disabled={!selectedDbTemplate}
              className="gap-2"
            >
              Continuar
              <ChevronRight size={16} />
            </Button>
          )}

          {step === 'pdf-upload' && (
            <Button
              onClick={() => setStep('category')}
              disabled={!selectedPdf}
              className="gap-2"
            >
              Continuar
              <ChevronRight size={16} />
            </Button>
          )}

          {step === 'category' && (
            <Button
              onClick={handleCreate}
              disabled={!selectedCategoria || isPendingCreate || isGenerating}
              className="gap-2"
            >
              {isPendingCreate || isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {creationMethod === 'ai' ? 'Gerando com IA...' : 'Criando...'}
                </>
              ) : (
                <>
                  {creationMethod === 'ai' && <Sparkles className="h-4 w-4" />}
                  Criar Proposta
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
