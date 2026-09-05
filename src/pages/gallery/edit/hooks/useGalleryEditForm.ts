import { useState, useEffect } from 'react';
import { addDays } from 'date-fns';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Client, TitleCaseMode, PricingModel, DiscountPackage } from '@/types/gallery';
import {
  RegrasCongeladas,
  buildRegrasFromDiscountPackages,
  discountPackagesFromRegras,
} from '@/lib/pricingUtils';
import { BillingMode, formatPhoneBR } from '../types';

interface UseGalleryEditFormProps {
  gallery: any;
  clients: Client[];
  updateGallery: any;
  deleteGallery: any;
  reopenSelection: any;
  createClient: any;
  refetchClients: () => void;
  settings: any;
  navigate: (path: string) => void;
  localPhotoCount: number | null;
  setLocalPhotoCount: (count: any) => void;
}

export function useGalleryEditForm({
  gallery,
  clients,
  updateGallery,
  deleteGallery,
  reopenSelection,
  createClient,
  refetchClients,
  settings,
  navigate,
  localPhotoCount,
  setLocalPhotoCount,
}: UseGalleryEditFormProps) {
  const queryClient = useQueryClient();

  const [nomeSessao, setNomeSessao] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clienteNome, setClienteNome] = useState('');
  const [clienteEmail, setClienteEmail] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [nomePacote, setNomePacote] = useState('');
  const [fotosIncluidas, setFotosIncluidas] = useState(0);
  const [valorFotoExtra, setValorFotoExtra] = useState(0);
  const [prazoSelecao, setPrazoSelecao] = useState<Date | undefined>();

  // Pricing model / progressive discounts
  const [pricingModel, setPricingModel] = useState<PricingModel>('fixed');
  const [discountPackages, setDiscountPackages] = useState<DiscountPackage[]>([]);
  const [regrasOverride, setRegrasOverride] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [pricingDirty, setPricingDirty] = useState(false);
  const [billingMode, setBillingMode] = useState<BillingMode>('studio');

  // Theme & font
  const [clientMode, setClientMode] = useState<'light' | 'dark'>('light');
  const [selectedThemeId, setSelectedThemeId] = useState<string | undefined>();
  const [sessionFont, setSessionFont] = useState('playfair');
  const [titleCaseMode, setTitleCaseMode] = useState<TitleCaseMode>('normal');
  const [photoSpacing, setPhotoSpacing] = useState(6);

  // UI state
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [reactivateSuccessOpen, setReactivateSuccessOpen] = useState(false);
  const [reactivateDays, setReactivateDays] = useState(7);

  const canReactivate =
    gallery?.status === 'selecao_completa' ||
    gallery?.status === 'confirmada' ||
    gallery?.status === 'expirado' ||
    gallery?.status === 'expirada';

  const isBillingLocked =
    gallery &&
    (gallery.statusSelecao === 'selecao_completa' || gallery.finalizedAt != null) &&
    gallery.status !== 'selecao_iniciada';

  const isLunariLinked = !!gallery?.sessionId;

  const minFotosIncluidasPermitido = Math.max(
    0,
    (gallery?.fotosSelecionadas ?? 0) - (gallery?.totalFotosExtrasVendidas ?? 0)
  );

  const fotosIncluidasAbaixoDoMinimo =
    !isBillingLocked &&
    (gallery?.totalFotosExtrasVendidas ?? 0) > 0 &&
    fotosIncluidas < minFotosIncluidasPermitido;

  const handleBillingModeChange = (mode: BillingMode) => {
    if (mode === billingMode) return;
    setBillingMode(mode);
    if (mode === 'studio') {
      if (isLunariLinked && regrasOverride) {
        setRestoreDialogOpen(true);
      }
      return;
    }
    if (mode === 'fixed') {
      setPricingModel('fixed');
      setPricingDirty(true);
    } else {
      if (discountPackages.length < 2) {
        const base = fotosIncluidas || 0;
        setDiscountPackages([
          {
            id: crypto.randomUUID(),
            minPhotos: base + 1,
            maxPhotos: base + 5,
            pricePerPhoto: valorFotoExtra || 0,
          },
          {
            id: crypto.randomUUID(),
            minPhotos: base + 6,
            maxPhotos: null,
            pricePerPhoto: 0,
          },
        ]);
      }
      setPricingModel('packages');
      setPricingDirty(true);
    }
  };

  // Initialize form with gallery data
  useEffect(() => {
    if (gallery) {
      setNomeSessao(gallery.nomeSessao || '');
      setClienteNome(gallery.clienteNome || '');
      setClienteEmail(gallery.clienteEmail || '');
      setClienteTelefone(gallery.clienteTelefone ? formatPhoneBR(gallery.clienteTelefone) : '');
      setNomePacote(gallery.nomePacote || '');
      setFotosIncluidas(gallery.fotosIncluidas);
      setValorFotoExtra(gallery.valorFotoExtra);
      setPrazoSelecao(gallery.prazoSelecao || undefined);

      const regras = gallery.regrasCongeladas;
      const faixasFromRegras = discountPackagesFromRegras(regras);
      const isPackages = faixasFromRegras.length >= 2;
      if (isPackages) {
        setPricingModel('packages');
        setDiscountPackages(faixasFromRegras);
      } else {
        setPricingModel('fixed');
        setDiscountPackages([]);
      }
      const override = gallery.regrasOverride ?? false;
      setRegrasOverride(override);

      const linked = !!gallery.sessionId;
      if (linked && !override) {
        setBillingMode('studio');
      } else {
        setBillingMode(isPackages ? 'packages' : 'fixed');
      }
      setPricingDirty(false);

      const cfg = gallery.configuracoes || {};
      if (cfg.clientMode === 'dark' || cfg.clientMode === 'light') {
        setClientMode(cfg.clientMode);
      }
      if (cfg.themeId) {
        setSelectedThemeId(cfg.themeId);
      }
      if (cfg.sessionFont) {
        setSessionFont(cfg.sessionFont);
      }
      if (cfg.titleCaseMode) {
        setTitleCaseMode(cfg.titleCaseMode as TitleCaseMode);
      }
      if (cfg.photoSpacing !== undefined) {
        setPhotoSpacing(cfg.photoSpacing);
      } else if (settings?.defaultPhotoSpacing !== undefined) {
        setPhotoSpacing(settings.defaultPhotoSpacing);
      }

      if (localPhotoCount === null) {
        setLocalPhotoCount(gallery.totalFotos);
      }

      if (gallery.clienteId) {
        const matchingClient = clients.find((c) => c.id === gallery.clienteId);
        if (matchingClient) {
          setSelectedClient(matchingClient);
        }
      }
    }
  }, [gallery, clients]);

  const computeFinalRegras = (): {
    regras: RegrasCongeladas | null | undefined;
    override: boolean | undefined;
  } => {
    if (isBillingLocked) return { regras: undefined, override: undefined };

    const initialChanged =
      pricingDirty ||
      fotosIncluidas !== gallery.fotosIncluidas ||
      valorFotoExtra !== gallery.valorFotoExtra;

    if (!initialChanged) return { regras: undefined, override: undefined };

    let finalRegras: RegrasCongeladas;
    if (pricingModel === 'packages' && discountPackages.length >= 2) {
      finalRegras = buildRegrasFromDiscountPackages(
        discountPackages,
        valorFotoExtra,
        fotosIncluidas,
        gallery.nomePacote || undefined
      );
    } else {
      const base = gallery.regrasCongeladas || ({} as RegrasCongeladas);
      finalRegras = {
        ...base,
        modelo: 'fixo',
        dataCongelamento: new Date().toISOString(),
        pacote: {
          ...(base.pacote || {}),
          nome: base.pacote?.nome || gallery.nomePacote || 'Pacote Manual',
          fotosIncluidas,
          valorFotoExtra,
        },
        precificacaoFotoExtra: { modelo: 'fixo', valorFixo: valorFotoExtra },
      };
    }

    const override = isLunariLinked ? true : regrasOverride;
    return { regras: finalRegras, override };
  };

  const persistGallery = async () => {
    try {
      const cleanPhone = clienteTelefone.replace(/\D/g, '');
      const existingConfig = gallery.configuracoes || {};
      const mergedConfig = {
        ...existingConfig,
        clientMode,
        themeId: selectedThemeId,
        sessionFont,
        titleCaseMode,
        photoSpacing,
      };

      const saleSettings = existingConfig.saleSettings as any;
      const { regras: finalRegras, override: finalOverride } = computeFinalRegras();

      await updateGallery({
        id: gallery.id,
        data: {
          nomeSessao,
          clienteNome,
          clienteEmail,
          clienteTelefone: cleanPhone || undefined,
          nomePacote: isBillingLocked
            ? gallery.nomePacote || undefined
            : nomePacote || undefined,
          fotosIncluidas: isBillingLocked ? gallery.fotosIncluidas : fotosIncluidas,
          valorFotoExtra: isBillingLocked ? gallery.valorFotoExtra : valorFotoExtra,
          prazoSelecao,
          configuracoes: mergedConfig,
          venda_modo: saleSettings?.mode,
          venda_pagamento_provedor: saleSettings?.paymentMethod,
          venda_tipo_cobranca: saleSettings?.chargeType,
          ...(finalRegras !== undefined ? { regrasCongeladas: finalRegras } : {}),
          ...(finalOverride !== undefined ? ({ regrasOverride: finalOverride } as any) : {}),
          themeId: selectedThemeId || null,
          useCustomTheme: !!selectedThemeId,
          themeOverrides: {
            ...((gallery as any).themeOverrides || {}),
            layout: {
              ...(((gallery as any).themeOverrides as any)?.layout || {}),
              gap: photoSpacing,
            },
          },
        },
      });
      toast.success('Galeria atualizada com sucesso!');
      navigate(
        gallery?.tipo === 'entrega'
          ? `/app/gallery/transfer/${gallery.id}`
          : `/app/gallery/select/${gallery.id}`
      );
    } catch (error) {
      console.error('Error updating gallery:', error);
    }
  };

  const handleRestoreSessionRules = async () => {
    try {
      await updateGallery({
        id: gallery.id,
        data: {
          regrasCongeladas: null,
          regrasOverride: false,
        } as any,
      });
      await queryClient.invalidateQueries({ queryKey: ['galleries'] });
      await queryClient.refetchQueries({ queryKey: ['galleries'] });
      toast.success('Regras da sessão restauradas');
      setRestoreDialogOpen(false);
    } catch (error) {
      console.error('Error restoring session rules:', error);
      toast.error('Erro ao restaurar regras da sessão');
    }
  };

  const handleSave = async () => {
    if (fotosIncluidasAbaixoDoMinimo) {
      toast.error(
        `Não é possível reduzir as fotos incluídas abaixo de ${minFotosIncluidasPermitido}: existem fotos já pagas como extras nesta galeria.`
      );
      return;
    }

    if (!isBillingLocked && pricingModel === 'packages' && discountPackages.length < 2) {
      toast.error(
        'Configure pelo menos 2 faixas para o modelo "Pacotes com descontos" ou troque para "Preço único".'
      );
      return;
    }

    await persistGallery();
  };

  const handleExtendDeadline = (days: number) => {
    const newDeadline = addDays(prazoSelecao || new Date(), days);
    setPrazoSelecao(newDeadline);
  };

  const handleDelete = async () => {
    await deleteGallery(gallery.id);
    navigate('/app/gallery/dashboard');
  };

  const handleReactivate = async (days: number = 7) => {
    try {
      await reopenSelection({ id: gallery.id, days } as any);
      await queryClient.invalidateQueries({ queryKey: ['galleries'] });
      await queryClient.invalidateQueries({ queryKey: ['galerias'] });
      await queryClient.invalidateQueries({ queryKey: ['client-gallery', gallery.id] });
      await queryClient.refetchQueries({ queryKey: ['galleries'] });
    } catch (error) {
      console.error('Error reactivating gallery:', error);
      throw error;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setClienteTelefone(formatPhoneBR(e.target.value));
  };

  const handleClientSelect = (client: Client | null) => {
    setSelectedClient(client);
    if (client) {
      setClienteNome(client.name);
      setClienteEmail(client.email);
      setClienteTelefone(client.phone ? formatPhoneBR(client.phone) : '');
    }
  };

  const handleCreateClient = async (data: {
    name: string;
    email: string;
    phone?: string;
    galleryPassword: string;
  }) => {
    try {
      const newClient = await createClient(data);
      setSelectedClient(newClient);
      setClienteNome(newClient.name);
      setClienteEmail(newClient.email);
      setClienteTelefone(newClient.phone ? formatPhoneBR(newClient.phone) : '');
      setIsClientModalOpen(false);
      refetchClients();
    } catch (error) {
      console.error('Error creating client:', error);
      toast.error('Erro ao criar cliente');
    }
  };

  const handleCopyPassword = () => {
    if (gallery?.galleryPassword) {
      navigator.clipboard.writeText(gallery.galleryPassword);
      toast.success('Senha copiada!');
    }
  };

  return {
    nomeSessao,
    setNomeSessao,
    selectedClient,
    setSelectedClient,
    clienteNome,
    setClienteNome,
    clienteEmail,
    setClienteEmail,
    clienteTelefone,
    setClienteTelefone,
    nomePacote,
    setNomePacote,
    fotosIncluidas,
    setFotosIncluidas,
    valorFotoExtra,
    setValorFotoExtra,
    prazoSelecao,
    setPrazoSelecao,
    pricingModel,
    setPricingModel,
    discountPackages,
    setDiscountPackages,
    regrasOverride,
    restoreDialogOpen,
    setRestoreDialogOpen,
    pricingDirty,
    setPricingDirty,
    billingMode,
    handleBillingModeChange,
    clientMode,
    setClientMode,
    selectedThemeId,
    setSelectedThemeId,
    sessionFont,
    setSessionFont,
    titleCaseMode,
    setTitleCaseMode,
    photoSpacing,
    setPhotoSpacing,
    isClientModalOpen,
    setIsClientModalOpen,
    showPassword,
    setShowPassword,
    reactivateOpen,
    setReactivateOpen,
    reactivateSuccessOpen,
    setReactivateSuccessOpen,
    reactivateDays,
    setReactivateDays,
    canReactivate,
    isBillingLocked,
    isLunariLinked,
    minFotosIncluidasPermitido,
    fotosIncluidasAbaixoDoMinimo,
    handleRestoreSessionRules,
    handleSave,
    handleExtendDeadline,
    handleDelete,
    handleReactivate,
    handlePhoneChange,
    handleClientSelect,
    handleCreateClient,
    handleCopyPassword,
  };
}
