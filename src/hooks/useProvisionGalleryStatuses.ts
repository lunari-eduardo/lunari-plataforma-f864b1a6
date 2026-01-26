import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAccessControl } from '@/hooks/useAccessControl';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook para auto-provisionar os status de sistema do Gallery
 * quando um usuário com acesso PRO + Gallery faz login.
 * 
 * Verifica se já existem status com is_system_status = true
 * e provisiona automaticamente se não existirem.
 */
export function useProvisionGalleryStatuses() {
  const { user } = useAuth();
  const { hasGaleryAccess } = useAccessControl();
  const provisionedRef = useRef(false);

  useEffect(() => {
    // Só executar se:
    // 1. Usuário está logado
    // 2. Tem acesso Gallery
    // 3. Ainda não verificou nesta sessão
    if (!user?.id || !hasGaleryAccess || provisionedRef.current) return;

    const checkAndProvision = async () => {
      try {
        // Verificar se já tem status de sistema
        const { data: systemStatuses, error: fetchError } = await supabase
          .from('etapas_trabalho')
          .select('id, nome')
          .eq('user_id', user.id)
          .eq('is_system_status', true)
          .limit(2);

        if (fetchError) {
          console.error('❌ Erro ao verificar status de sistema:', fetchError);
          return;
        }

        // Verificar se já tem os dois status necessários
        const hasEnviado = systemStatuses?.some(s => s.nome === 'Enviado para seleção');
        const hasSelecao = systemStatuses?.some(s => s.nome === 'Seleção finalizada');

        if (!hasEnviado || !hasSelecao) {
          console.log('🔧 Provisionando status de sistema Gallery...');
          
          const { error: provisionError } = await supabase.functions.invoke(
            'provision-gallery-workflow-statuses',
            {
              body: { userId: user.id, action: 'provision' }
            }
          );

          if (provisionError) {
            console.error('❌ Erro ao provisionar status:', provisionError);
          } else {
            console.log('✅ Status de sistema Gallery provisionados com sucesso');
          }
        } else {
          console.log('✅ Status de sistema Gallery já existem');
        }
      } catch (err) {
        console.error('❌ Erro no provisionamento:', err);
      } finally {
        provisionedRef.current = true;
      }
    };

    checkAndProvision();
  }, [user?.id, hasGaleryAccess]);
}
