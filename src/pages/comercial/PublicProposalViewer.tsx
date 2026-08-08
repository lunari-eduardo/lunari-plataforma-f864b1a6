import React, { useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePublicMaterial } from '@/hooks/usePublicMaterial';
import { useTrackedMaterial } from '@/hooks/useTrackedMaterial';
import { VisualRenderer } from './components/editor/VisualRenderer';
import { Loader2, MessageCircle } from 'lucide-react';

export default function PublicProposalViewer({ mode }: { mode: 'public' | 'tracked' }) {
  const { slug, token } = useParams<{ slug?: string; token?: string }>();

  const publicData = usePublicMaterial(mode === 'public' ? slug : undefined);
  const trackedData = useTrackedMaterial(mode === 'tracked' ? token : undefined);

  const activeQuery = mode === 'public' ? publicData : trackedData;
  const { data: result, isLoading, error } = activeQuery;

  // Registrar view_start quando carregar a proposta rastreável
  useEffect(() => {
    if (mode === 'tracked' && result?.type === 'active' && result.shareLinkId) {
      supabase.functions.invoke('track-share-event', {
        body: {
          share_id: result.shareLinkId,
          event_type: 'view_start'
        }
      }).catch(err => {
        console.error('Falha ao registrar view_start:', err);
      });
    }
  }, [mode, result?.type, result?.shareLinkId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || result?.type === 'not_found' || !result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FDFBF7] p-4 text-center">
        <h1 className="text-3xl font-serif text-[#2C2825] mb-4">Proposta não encontrada</h1>
        <p className="text-[#6D655E]">Este link pode ter expirado ou estar incorreto.</p>
      </div>
    );
  }

  if (result.type === 'redirect' && result.redirectSlug) {
    return <Navigate to={`/${result.redirectSlug}`} replace />;
  }

  const { data: blocks, materialInfo, userProfile } = result;

  // Lógica do CTA WhatsApp
  const handleWhatsAppClick = () => {
    // TODO: Registrar evento cta_click via Edge Function na Fase 7
    if (!userProfile?.whatsapp) {
      alert('O fotógrafo ainda não configurou um número de WhatsApp.');
      return;
    }
    
    const phone = userProfile.whatsapp.replace(/\D/g, '');
    const title = materialInfo?.title || 'orçamento';
    const message = encodeURIComponent(`Olá! Vi o orçamento de ${title} e tenho interesse.`);
    
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col relative pb-24">
      <VisualRenderer 
        blocks={blocks || []}
        activeIndex={-1}
        onSelectBlock={() => {}}
        viewMode="desktop"
      />

      {/* Floating CTA WhatsApp */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background/90 to-transparent flex justify-center z-50 pointer-events-none">
        <button 
          onClick={handleWhatsAppClick}
          className="pointer-events-auto shadow-2xl bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-full font-medium flex items-center gap-3 transition-transform hover:scale-105 active:scale-95"
        >
          <MessageCircle className="w-5 h-5" />
          Quero falar com o fotógrafo
        </button>
      </div>
    </div>
  );
}
