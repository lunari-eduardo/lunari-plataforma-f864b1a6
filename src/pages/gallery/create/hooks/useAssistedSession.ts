import { useState, useEffect, MutableRefObject } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Client, SaleMode, PricingModel } from '@/types/gallery';
import { GestaoPackage } from '@/hooks/useGestaoPackages';
import { RegrasCongeladas, sanitizeExtraPrice } from '@/lib/pricingUtils';

export interface PriorDeletion {
  nome_sessao: string | null;
  deleted_at: string;
  fotos_count: number | null;
}

interface UseAssistedSessionProps {
  gestaoParams: any;
  hasGestaoSession: boolean;
  isAssistedMode: boolean;
  hasGestaoIntegration: boolean;
  clients: Client[];
  isLoadingClients: boolean;
  gestaoPackages: GestaoPackage[];
  isLoadingPackages: boolean;
  paramsProcessed: boolean;
  markAsProcessed: () => void;
  clearParams: () => void;
  fetchClientById: (id: string) => Promise<Client | null>;
  addClientToCache: (client: Client) => void;
  createClient: (data: any) => Promise<Client>;
  setSelectedClient: (client: Client | null) => void;
  setUseExistingPassword: (use: boolean) => void;
  packageName: string;
  setPackageName: (name: string) => void;
  userTouchedPackageNameRef: MutableRefObject<boolean>;
  setIncludedPhotos: (photos: number) => void;
  setFixedPrice: (price: number) => void;
  setSaleMode: (mode: SaleMode) => void;
  userTouchedSaleModeRef: MutableRefObject<boolean>;
  setPricingModel: (model: PricingModel) => void;
  userTouchedPricingModelRef: MutableRefObject<boolean>;
}

export function useAssistedSession({
  gestaoParams,
  hasGestaoSession,
  isAssistedMode,
  hasGestaoIntegration,
  clients,
  isLoadingClients,
  gestaoPackages,
  isLoadingPackages,
  paramsProcessed,
  markAsProcessed,
  clearParams,
  fetchClientById,
  addClientToCache,
  createClient,
  setSelectedClient,
  setUseExistingPassword,
  packageName,
  setPackageName,
  userTouchedPackageNameRef,
  setIncludedPhotos,
  setFixedPrice,
  setSaleMode,
  userTouchedSaleModeRef,
  setPricingModel,
  userTouchedPricingModelRef,
}: UseAssistedSessionProps) {
  const [regrasCongeladas, setRegrasCongeladas] = useState<RegrasCongeladas | null>(null);
  const [isLoadingRegras, setIsLoadingRegras] = useState(false);
  const [regrasLoaded, setRegrasLoaded] = useState(false);
  const [sessionClienteId, setSessionClienteId] = useState<string | null>(null);
  const [priorDeletion, setPriorDeletion] = useState<PriorDeletion | null>(null);

  // Fetch frozen pricing rules from Gestão session
  useEffect(() => {
    const sessionId = gestaoParams?.session_id;

    if (!sessionId) {
      setRegrasLoaded(true);
      return;
    }

    const fetchSessionData = async () => {
      setIsLoadingRegras(true);
      try {
        console.log('🔗 Fetching session data for:', sessionId);
        const { data, error } = await supabase
          .from('clientes_sessoes')
          .select('id, session_id, cliente_id, regras_congeladas, valor_foto_extra')
          .eq('session_id', sessionId)
          .single();

        if (error) {
          console.warn('Session not found or error:', error.message);
        } else {
          console.log('🔗 Session data found:', data);
          if (data?.cliente_id) {
            console.log(
              '[AssistedMode] sessionClienteId resolvido via clientes_sessoes:',
              data.cliente_id
            );
            setSessionClienteId(data.cliente_id);
          }
          if (data?.regras_congeladas) {
            const regras = data.regras_congeladas as unknown as RegrasCongeladas;
            console.log('🔗 regrasCongeladas loaded:', {
              fotosIncluidas: regras.pacote?.fotosIncluidas,
              valorFotoExtra: regras.pacote?.valorFotoExtra,
              pacoteNome: regras.pacote?.nome,
              categoria: regras.pacote?.categoria,
            });
            setRegrasCongeladas(regras);
          }

          if (data?.valor_foto_extra && data.valor_foto_extra > 0) {
            const valorSanitizado = sanitizeExtraPrice(data.valor_foto_extra);
            setFixedPrice(valorSanitizado);
          }
        }
      } catch (error) {
        console.error('Error fetching session data:', error);
      } finally {
        setIsLoadingRegras(false);
        setRegrasLoaded(true);
      }
    };

    fetchSessionData();
  }, [gestaoParams?.session_id]);

  // Checa se a sessão já teve uma galeria excluída anteriormente
  useEffect(() => {
    const sessionId = gestaoParams?.session_id;
    if (!sessionId) return;

    (async () => {
      const { data, error } = await (supabase as any)
        .from('galerias_sessao_historico')
        .select('nome_sessao, deleted_at, fotos_count')
        .eq('session_id', sessionId)
        .order('deleted_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) setPriorDeletion(data);
    })();
  }, [gestaoParams?.session_id]);

  // Sync includedPhotos, packageName, fixedPrice from regrasCongeladas
  useEffect(() => {
    if (!regrasLoaded || !regrasCongeladas || !gestaoParams?.session_id) return;
    const { pacote } = regrasCongeladas;

    if (pacote?.fotosIncluidas !== undefined && pacote.fotosIncluidas > 0) {
      console.log('🔗 Syncing includedPhotos from regrasCongeladas:', pacote.fotosIncluidas);
      setIncludedPhotos(pacote.fotosIncluidas);
    }

    if (pacote?.nome && !userTouchedPackageNameRef.current && !packageName) {
      console.log('🔗 Syncing packageName from regrasCongeladas:', pacote.nome);
      setPackageName(pacote.nome);
    }

    if (pacote?.valorFotoExtra !== undefined && pacote.valorFotoExtra > 0) {
      const valorJsonb = sanitizeExtraPrice(pacote.valorFotoExtra);
      const valorUrl = gestaoParams?.preco_da_foto_extra;

      if (valorUrl !== undefined && valorUrl > 0 && Math.abs(valorUrl - valorJsonb) > 0.01) {
        const valorUrlSanitizado = sanitizeExtraPrice(valorUrl);
        console.warn(
          '[GalleryCreate] Divergência preco_da_foto_extra na hidratação: URL=',
          valorUrlSanitizado,
          'JSONB=',
          valorJsonb,
          '— usando URL (mais fresca)'
        );
        setFixedPrice(valorUrlSanitizado);
      } else {
        console.log('🔗 Syncing fixedPrice from regrasCongeladas:', valorJsonb);
        setFixedPrice(valorJsonb);
      }
    }
  }, [regrasLoaded, regrasCongeladas, gestaoParams?.session_id, gestaoParams?.preco_da_foto_extra]);

  // Modo Assistido (Studio → Gallery)
  useEffect(() => {
    if (!hasGestaoSession || !gestaoParams || paramsProcessed) return;

    if (gestaoParams.pacote_nome && isLoadingPackages) {
      console.log('[AssistedMode] aguardando packages...');
      return;
    }
    if (!regrasLoaded) {
      console.log('[AssistedMode] aguardando regras/sessão...');
      return;
    }

    console.log('[AssistedMode] processing', {
      gestaoParams,
      sessionClienteId,
      hasGestaoIntegration,
    });

    // Stage A: pacote/sessão/preço/sale (somente com integração ativa)
    if (isAssistedMode) {
      if (gestaoParams.pacote_nome && !userTouchedPackageNameRef.current) {
        setPackageName(gestaoParams.pacote_nome);
        const packageFromGestao = gestaoPackages.find(
          (pkg) => pkg.nome.toLowerCase() === gestaoParams.pacote_nome?.toLowerCase()
        );
        if (packageFromGestao) {
          if (!gestaoParams.fotos_incluidas_no_pacote && packageFromGestao.fotosIncluidas) {
            setIncludedPhotos(packageFromGestao.fotosIncluidas);
          }
          if (
            !gestaoParams.preco_da_foto_extra &&
            packageFromGestao.valorFotoExtra &&
            !regrasCongeladas
          ) {
            setFixedPrice(packageFromGestao.valorFotoExtra);
          }
        }
      }

      if (gestaoParams.fotos_incluidas_no_pacote) {
        setIncludedPhotos(gestaoParams.fotos_incluidas_no_pacote);
      }
      if (gestaoParams.preco_da_foto_extra) {
        setFixedPrice(sanitizeExtraPrice(gestaoParams.preco_da_foto_extra));
      }
      if (gestaoParams.modelo_de_cobranca) {
        userTouchedSaleModeRef.current = true;
        setSaleMode(gestaoParams.modelo_de_cobranca);
      }
      if (gestaoParams.modelo_de_preco) {
        userTouchedPricingModelRef.current = true;
        setPricingModel(gestaoParams.modelo_de_preco);
      }
    }

    // Stage B: cliente (SESSION-FIRST, URL como fallback)
    const resolveClient = async (): Promise<boolean> => {
      const candidateIds = [sessionClienteId, gestaoParams.cliente_id].filter(Boolean) as string[];

      if (!gestaoParams.cliente_id && sessionClienteId) {
        console.warn(
          '[AssistedMode] URL chegou SEM cliente_id mas session tem — provável truncamento de URL em mobile/PWA'
        );
      }

      for (const id of candidateIds) {
        // 1) cache em memória
        const fromCache = clients.find((c) => c.id === id);
        if (fromCache) {
          console.log('[AssistedMode] cache HIT:', fromCache.name);
          setSelectedClient(fromCache);
          setUseExistingPassword(!!fromCache.galleryPassword);
          return true;
        }
        // 2) busca direta no banco
        console.log('[AssistedMode] cache MISS — DB lookup:', id);
        const fromDb = await fetchClientById(id);
        if (fromDb) {
          console.log('[AssistedMode] DB HIT:', fromDb.name);
          addClientToCache(fromDb);
          setSelectedClient(fromDb);
          setUseExistingPassword(!!fromDb.galleryPassword);
          return true;
        }
      }

      // 3) auto-criar a partir dos dados do Studio (URL)
      if (gestaoParams.cliente_nome) {
        try {
          console.log('[AssistedMode] auto-create do Studio:', gestaoParams.cliente_nome);
          const created = await createClient({
            name: gestaoParams.cliente_nome,
            email: gestaoParams.cliente_email || '',
            phone: gestaoParams.cliente_telefone,
          });
          setSelectedClient(created);
          setUseExistingPassword(!!created.galleryPassword);
          toast.success('Cliente vinculado automaticamente do Studio');
          return true;
        } catch (e: any) {
          console.error('[AssistedMode] falha ao auto-criar cliente:', e?.message || e);
        }
      }

      console.error('[AssistedMode] não foi possível resolver cliente da sessão', {
        candidateIds,
        sessionClienteId,
      });
      toast.error('Não foi possível identificar o cliente da sessão. Selecione manualmente abaixo.');
      return false;
    };

    const shouldResolveClient =
      !!sessionClienteId || !!gestaoParams.cliente_id || !!gestaoParams.cliente_nome;

    const finish = () => {
      console.log('[AssistedMode] marcando params como processados');
      markAsProcessed();
      clearParams();
    };

    if (shouldResolveClient) {
      if (isLoadingClients) {
        console.log('[AssistedMode] aguardando clients...');
        return;
      }
      resolveClient().finally(finish);
    } else {
      finish();
    }
  }, [
    hasGestaoSession,
    isAssistedMode,
    hasGestaoIntegration,
    gestaoParams,
    clients,
    gestaoPackages,
    isLoadingClients,
    isLoadingPackages,
    paramsProcessed,
    markAsProcessed,
    clearParams,
    fetchClientById,
    addClientToCache,
    createClient,
    regrasCongeladas,
    regrasLoaded,
    sessionClienteId,
  ]);

  return {
    regrasCongeladas,
    isLoadingRegras,
    regrasLoaded,
    sessionClienteId,
    priorDeletion,
  };
}
