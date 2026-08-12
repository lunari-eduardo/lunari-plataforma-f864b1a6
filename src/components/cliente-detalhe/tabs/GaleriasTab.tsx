import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ClienteSupabase } from '@/types/cliente-supabase';
import { GalleryCard } from '@/components/GalleryCard';
import { DeliverGalleryCard } from '@/components/DeliverGalleryCard';
import { Button } from '@/components/ui/button';
import { Plus, Image as ImageIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Galeria } from '@/hooks/useSupabaseGalleries';

interface GaleriasTabProps {
  cliente: ClienteSupabase;
}

export function GaleriasTab({ cliente }: GaleriasTabProps) {
  const [galerias, setGalerias] = useState<Galeria[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchGalerias = async () => {
      try {
        const { data: sessoes, error: sessError } = await supabase
          .from('clientes_sessoes')
          .select('session_id')
          .eq('cliente_id', cliente.id);

        if (sessError) throw sessError;

        if (sessoes && sessoes.length > 0) {
          const sessionIds = sessoes.map(s => s.session_id).filter(Boolean);
          const { data, error } = await supabase
            .from('photo_sessions')
            .select('*')
            .in('id', sessionIds)
            .order('created_at', { ascending: false });

          if (error) throw error;
          if (data) {
            const parsed = data.map(g => ({
              id: g.id,
              userId: g.user_id,
              title: g.title,
              date: g.date,
              createdAt: g.created_at,
              status: g.status,
              type: g.type,
              coverUrl: g.cover_url,
              photoCount: g.photo_count || 0,
              prazoSelecao: g.prazo_selecao,
              watermarkId: g.watermark_id,
              valorFotoExtra: g.valor_foto_extra || 0,
              storageSize: g.storage_size || 0,
              downloadsEnabled: g.downloads_enabled,
              publicToken: g.public_token,
              totalValue: g.total_value,
              statusPagamento: g.status_pagamento,
              checkoutUrl: g.checkout_url,
              finalizedAt: g.finalized_at,
              statusSelecao: g.status_selecao,
              paymentMethodId: g.payment_method_id,
              regrasCongeladas: g.regras_congeladas
            }));
            setGalerias(parsed as Galeria[]);
          }
        }
      } catch (error) {
        console.error('Erro ao buscar galerias do cliente:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGalerias();
  }, [cliente.id]);

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Carregando galerias...</div>;
  }

  if (galerias.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/40 p-12 text-center mt-4">
        <ImageIcon className="mb-3 h-8 w-8 text-muted-foreground/60" />
        <h3 className="text-sm font-medium text-foreground">Nenhuma galeria encontrada</h3>
        <p className="mt-1 mb-4 text-xs text-muted-foreground">
          Este cliente ainda não possui nenhuma galeria vinculada a ele.
        </p>
        <Button onClick={() => navigate('/app/gallery/new/select', { state: { preselectClient: cliente.id } })} size="sm" variant="outline" className="h-8 text-xs">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Criar Galeria
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-medium">Galerias e Entregas</h3>
        <Button onClick={() => navigate('/app/gallery/new/select', { state: { preselectClient: cliente.id } })} size="sm" className="h-8 text-xs">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Nova
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {galerias.map((galeria) => {
          if (galeria.type === 'transfer') {
            return (
              <DeliverGalleryCard
                key={galeria.id}
                gallery={galeria}
                onDelete={() => {}}
                onSend={() => {}}
                onReactivate={() => {}}
              />
            );
          }
          return (
            <GalleryCard
              key={galeria.id}
              gallery={galeria}
              onDelete={() => {}}
              onSend={() => {}}
              onReactivate={() => {}}
            />
          );
        })}
      </div>
    </div>
  );
}
