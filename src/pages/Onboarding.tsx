import React from 'react';
import { useOnboarding } from '@/hooks/useOnboarding';
import {
  OnboardingLayout,
  StepWelcome,
  StepBusiness,
  StepPhotographyTypes,
  StepContracts,
  StepForms,
  StepBrand,
  StepPricing,
  StepCompleted,
} from '@/components/onboarding/new';
import { Loader2 } from 'lucide-react';

export default function Onboarding() {
  const {
    currentStep,
    formData,
    isLoading,
    isSaving,
    isUploadingLogo,
    lastSavedStep,
    updateFormData,
    handleBusinessChange,
    uploadLogo,
    removeLogo,
    nextStep,
    prevStep,
    resumeWhereLeft,
    goToStep,
    finishOnboarding,
    skipOnboarding,
  } = useOnboarding();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-white/60">
          <Loader2 className="w-8 h-8 animate-spin text-[#C6A36A]" />
          <span className="text-xs font-light">Preparando ambiente...</span>
        </div>
      </div>
    );
  }

  const isWideStep = currentStep === 2 || currentStep === 3 || currentStep === 4 || currentStep === 5 || currentStep === 6;
  const maxWidthClass = isWideStep ? 'max-w-2xl' : 'max-w-xl';

  const nextLabel =
    currentStep === 6
      ? 'Salvar e continuar'
      : currentStep === 1
      ? 'Continuar'
      : 'Continuar';

  return (
    <OnboardingLayout
      currentStep={currentStep}
      isSaving={isSaving}
      onBack={prevStep}
      onNext={nextStep}
      onSkip={skipOnboarding}
      nextButtonLabel={nextLabel}
      hideFooterActions={currentStep === 0 || currentStep === 7}
      maxWidthClass={maxWidthClass}
    >
      {currentStep === 0 && (
        <StepWelcome
          lastSavedStep={lastSavedStep}
          onStart={() => goToStep(1)}
          onResume={resumeWhereLeft}
          onSkip={skipOnboarding}
        />
      )}

      {currentStep === 1 && (
        <StepBusiness
          data={formData.business}
          onChange={handleBusinessChange}
        />
      )}

      {currentStep === 2 && (
        <StepPhotographyTypes
          data={formData.photographyTypes}
          onChange={(updates) => updateFormData('photographyTypes', updates)}
        />
      )}

      {currentStep === 3 && (
        <StepContracts
          wantsContracts={formData.contracts.wantsContracts}
          selectedSlugs={formData.contracts.selectedSlugs}
          onChange={(wants, slugs) =>
            updateFormData('contracts', { wantsContracts: wants, selectedSlugs: slugs })
          }
        />
      )}

      {currentStep === 4 && (
        <StepForms
          wantsForms={formData.forms.wantsForms}
          selectedSlugs={formData.forms.selectedSlugs}
          onChange={(wants, slugs) =>
            updateFormData('forms', { wantsForms: wants, selectedSlugs: slugs })
          }
        />
      )}

      {currentStep === 5 && (
        <StepBrand
          data={formData.brand}
          onChange={(updates) => updateFormData('brand', updates)}
          onUploadLogo={uploadLogo}
          onRemoveLogo={removeLogo}
          isUploadingLogo={isUploadingLogo}
        />
      )}

      {currentStep === 6 && (
        <StepPricing
          model={formData.pricing.model}
          onChange={(model) => updateFormData('pricing', { model })}
        />
      )}

      {currentStep === 7 && (
        <StepCompleted
          formData={formData}
          onFinish={finishOnboarding}
          isSaving={isSaving}
        />
      )}
    </OnboardingLayout>
  );
}
