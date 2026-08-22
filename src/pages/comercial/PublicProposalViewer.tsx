import React, { useEffect, useRef, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { usePublicMaterial } from '@/hooks/usePublicMaterial';
import { useTrackedMaterial } from '@/hooks/useTrackedMaterial';
import { useShareTracking } from '@/hooks/useShareTracking';
import { NativePdfViewer } from './components/editor/NativePdfViewer';
import { VisualRenderer } from './components/editor/VisualRenderer';
import { Loader2, MessageCircle } from 'lucide-react';
import { PublicThemeWrapper } from '@/components/shared/PublicThemeWrapper';

export default function PublicProposalViewer({ mode }: { mode: 'public' | 'tracked' }) {
  const { slug, token } = useParams<{ slug?: string; token?: string }>();

  const publicData = usePublicMaterial(mode === 'public' ? slug : undefined);
  const trackedData = useTrackedMaterial(mode === 'tracked' ? token : undefined);

  const activeQuery = mode === 'public' ? publicData : trackedData;
  const { data: result, isLoading, error } = activeQuery;

  // Iniciar SDK de rastreio
  const { trackEvent } = useShareTracking({
    token: mode === 'tracked' ? token : undefined,
    slug: mode === 'public' ? slug : undefined
  });

  const ctaRef = useRef<HTMLButtonElement>(null);
  const [ctaViewTracked, setCtaViewTracked] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  // Rastrear visualização do CTA
  useEffect(() => {
    if (!ctaRef.current || ctaViewTracked || !result) return;
    
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        trackEvent('cta_view');
        setCtaViewTracked(true);
        observer.disconnect();
      }
    }, { threshold: 0.5 });

    observer.observe(ctaRef.current);
    return () => observer.disconnect();
  }, [ctaViewTracked, trackEvent, result]);

  if (isLoading) {
    return (
      <PublicThemeWrapper>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PublicThemeWrapper>
    );
  }

  if (error || result?.type === 'not_found' || !result) {
    return (
      <PublicThemeWrapper>
        <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
          <h1 className="text-3xl font-serif text-[#2C2825] mb-4">Proposta não encontrada</h1>
          <p className="text-[#6D655E]">Este link pode ter expirado ou estar incorreto.</p>
        </div>
      </PublicThemeWrapper>
    );
  }

  if (result.type === 'redirect' && result.redirectSlug) {
    return <Navigate to={`/${result.redirectSlug}`} replace />;
  }

  const { data: contentData, materialInfo, userProfile } = result;
  
  // Detecção de formato
  const isPdfFormat = contentData && !Array.isArray(contentData) && contentData.type === 'pdf';
  const pdfUrl = isPdfFormat ? contentData.url : '';
  let blocks = isPdfFormat ? [] : (contentData || []);
  let hideWhatsApp = false;
  let designTokens: any = undefined;
  if (isPdfFormat && contentData?.settings) {
    hideWhatsApp = contentData.settings.hideWhatsApp;
    designTokens = contentData.settings.design_tokens;
  } else if (!isPdfFormat) {
    const settingsBlock = blocks.find((b: any) => b.type === 'global_settings');
    if (settingsBlock) {
      hideWhatsApp = settingsBlock.data?.hideWhatsApp;
      designTokens = settingsBlock.data?.design_tokens;
      blocks = blocks.filter((b: any) => b.type !== 'global_settings');
    }
  }

  // Lógica do CTA WhatsApp
  const handleWhatsAppClick = (ctaLabel?: string) => {
    trackEvent('cta_click', { cta_type: ctaLabel ? 'block_cta' : 'whatsapp' });

    if (!userProfile?.whatsapp) {
      alert('O fotógrafo ainda não configurou um número de WhatsApp.');
      return;
    }

    const phone = userProfile.whatsapp.replace(/\D/g, '');
    const title = materialInfo?.title || 'orçamento';
    const suffix = ctaLabel ? ` (interessado em: ${ctaLabel})` : '';
    const message = encodeURIComponent(`Olá! Vi o orçamento de ${title}${suffix} e tenho interesse.`);

    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  };

  const handleStart = () => {
    setHasStarted(true);
    // Aqui garantimos que qualquer mídia autoplay possa iniciar após a interação do usuário
  };

  // Portão de mensagem personalizada: só existe enquanto o usuário não avançou
  if (!hasStarted && result.customMessage) {
    return (
      <PublicThemeWrapper primaryColor={(result as any).theme?.primaryColor || undefined}>
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-black/5">
            {userProfile?.avatar_url && (
              <img src={userProfile.avatar_url} alt="Fotógrafo" className="w-20 h-20 rounded-full mx-auto mb-6 object-cover" />
            )}
            <h2 className="text-2xl font-serif text-[#2C2825] mb-4">
              Mensagem para você
            </h2>
            <p className="text-[#6D655E] mb-8 whitespace-pre-wrap italic">
              "{result.customMessage}"
            </p>
            <button
              onClick={handleStart}
              className="w-full bg-[#2C2825] hover:bg-black text-white px-6 py-4 rounded-xl font-medium transition-all"
            >
              Acessar Proposta
            </button>
          </div>
        </div>
      </PublicThemeWrapper>
    );
  }

  return (
    <PublicThemeWrapper primaryColor={(result as any).theme?.primaryColor || undefined} className="flex flex-col relative pb-24">
      {isPdfFormat ? (
        <NativePdfViewer url={pdfUrl} logoUrl={userProfile?.avatar_url} />
      ) : (
        <VisualRenderer
          blocks={blocks}
          activeIndex={-1}
          onSelectBlock={() => {}}
          viewMode="desktop"
          mode="public"
          onCtaClick={({ label }) => handleWhatsAppClick(label)}
          designTokens={designTokens}
          onSectionView={(blockId, blockType, position) => {
            trackEvent('section_view', { blockId, blockType, position });
          }}
        />
      )}

      {!hideWhatsApp && (
        <>
          {/* Floating CTA WhatsApp */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background/90 to-transparent flex justify-center z-50 pointer-events-none">
            <button
              ref={ctaRef}
              onClick={() => handleWhatsAppClick()}
              className="pointer-events-auto shadow-2xl bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-full font-medium flex items-center gap-3 transition-transform hover:scale-105 active:scale-95"
            >
              <MessageCircle className="w-5 h-5" />
              Quero falar com o fotógrafo
            </button>
          </div>
        </>
      )}
    </PublicThemeWrapper>
  );
}
