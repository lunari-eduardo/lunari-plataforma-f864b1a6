import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GalleryPhoto } from '@/types/gallery';

interface UseGalleryVisitorsProps {
  id: string | undefined;
  isPublicGallery: boolean;
}

export function useGalleryVisitors({
  id,
  isPublicGallery,
}: UseGalleryVisitorsProps) {
  const [expandedVisitorId, setExpandedVisitorId] = useState<string | null>(null);
  const [visitorPhotosMap, setVisitorPhotosMap] = useState<Record<string, GalleryPhoto[]>>({});
  const [visitorCodesModalId, setVisitorCodesModalId] = useState<string | null>(null);
  const [loadingVisitorPhotos, setLoadingVisitorPhotos] = useState<string | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  // Fetch visitors for public galleries
  const { data: visitorsData, isLoading: isLoadingVisitors, refetch: refetchVisitors } = useQuery({
    queryKey: ['galeria-visitantes', id],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { visitors: [] };
      
      const response = await fetch(`${supabaseUrl}/functions/v1/gallery-visitors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ galleryId: id }),
      });
      
      if (!response.ok) return { visitors: [] };
      return response.json();
    },
    enabled: !!id && !!isPublicGallery,
  });

  // Fetch visitor photos when expanding
  const fetchVisitorPhotos = useCallback(async (visitorId: string) => {
    if (visitorPhotosMap[visitorId]) return;
    setLoadingVisitorPhotos(visitorId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const response = await fetch(`${supabaseUrl}/functions/v1/gallery-visitors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ galleryId: id, visitorId }),
      });
      if (!response.ok) return;
      const data = await response.json();
      const mapped: GalleryPhoto[] = (data.selectedPhotos || []).map((p: any) => ({
        id: p.id,
        filename: p.filename || '',
        originalFilename: p.original_filename || p.filename || '',
        thumbnailUrl: '',
        previewUrl: '',
        originalUrl: '',
        width: p.width || 0,
        height: p.height || 0,
        isSelected: true,
        isFavorite: (data.selections || []).find((s: any) => s.foto_id === p.id)?.is_favorite || false,
        comment: (data.selections || []).find((s: any) => s.foto_id === p.id)?.comment || undefined,
        order: 0,
        folderId: null,
      }));
      setVisitorPhotosMap(prev => ({ ...prev, [visitorId]: mapped }));
    } catch (e) {
      console.error('Error fetching visitor photos:', e);
    } finally {
      setLoadingVisitorPhotos(null);
    }
  }, [id, visitorPhotosMap, supabaseUrl]);

  return {
    isPublicGallery,
    visitorsData,
    isLoadingVisitors,
    refetchVisitors,
    expandedVisitorId,
    setExpandedVisitorId,
    visitorPhotosMap,
    visitorCodesModalId,
    setVisitorCodesModalId,
    loadingVisitorPhotos,
    fetchVisitorPhotos,
  };
}
