import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useConfigurationContext } from '@/contexts/ConfigurationContext';
import { useMaterials } from '@/hooks/useMaterials';
import { useProposalGenerate, type ProposalBriefing } from '@/hooks/useProposalAI';
import { gestaoR2Upload } from '@/lib/gestaoR2Upload';
import { uploadProposalImage } from '../../blocks/uploadImage';
import { toast } from 'sonner';
import { Step, Categoria, DbTemplate, AiRef } from '../types';

interface UseCreateMaterialWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export function useCreateMaterialWizard({ isOpen, onClose }: UseCreateMaterialWizardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { pacotes, produtos } = useConfigurationContext();
  const { createMaterial } = useMaterials();
  const { generate, isGenerating } = useProposalGenerate();

  // Wizard state
  const [step, setStep] = useState<Step>('method');
  const [selectedCategoria, setSelectedCategoria] = useState<Categoria | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [creationMethod, setCreationMethod] = useState<'ai' | 'template' | 'db-template' | 'pdf' | null>(null);
  const [selectedDbTemplate, setSelectedDbTemplate] = useState<DbTemplate | null>(null);

  // Briefing para geração com IA
  const [briefing, setBriefing] = useState<ProposalBriefing>({
    session_type: 'Ensaio Gestante',
    tone: 'Acolhedor',
  });
  const [selectedPacoteIds, setSelectedPacoteIds] = useState<string[]>([]);

  // Referências de layout/design para a IA
  const [aiRefs, setAiRefs] = useState<AiRef[]>([]);
  const [isUploadingRef, setIsUploadingRef] = useState(false);

  // PDF Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  // Nome do fotógrafo: preenchido automaticamente com o perfil
  useEffect(() => {
    if (step === 'ai-briefing' && profile) {
      const name = (profile.empresa || profile.nome || '').trim();
      if (name) {
        setBriefing((b) => (b.photographer_name ? b : { ...b, photographer_name: name }));
      }
    }
  }, [step, profile]);

  const addRefImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    const room = Math.max(0, 6 - aiRefs.filter((r) => r.kind === 'image').length);
    if (files.length > room) toast.info('Máximo de 6 imagens de referência.');
    setIsUploadingRef(true);
    try {
      for (const f of files.slice(0, room)) {
        if (f.size > 10 * 1024 * 1024) {
          toast.error(`"${f.name}" passa de 10MB.`);
          continue;
        }
        try {
          const url = await uploadProposalImage(f);
          setAiRefs((prev) => [
            ...prev,
            { id: crypto.randomUUID(), name: f.name, kind: 'image', url, mime: 'image/jpeg' },
          ]);
        } catch {
          toast.error(`Erro ao enviar "${f.name}".`);
        }
      }
    } finally {
      setIsUploadingRef(false);
    }
  };

  const addRefPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (aiRefs.some((r) => r.kind === 'pdf')) {
      toast.error('Envie no máximo 1 PDF de referência.');
      return;
    }
    if (f.size > 15 * 1024 * 1024) {
      toast.error('O PDF passa de 15MB.');
      return;
    }
    setIsUploadingRef(true);
    try {
      const result = await gestaoR2Upload({ file: f, context: 'proposals-pdf' });
      const url = result.url || `https://documents.lunarihub.com/${result.storagePath}`;
      setAiRefs((prev) => [
        ...prev,
        { id: crypto.randomUUID(), name: f.name, kind: 'pdf', url, mime: 'application/pdf' },
      ]);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar PDF de referência.');
    } finally {
      setIsUploadingRef(false);
    }
  };

  const addRefText = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    for (const f of files) {
      if (f.size > 300 * 1024) {
        toast.error(`"${f.name}" passa de 300KB.`);
        continue;
      }
      const content = await f.text();
      setAiRefs((prev) => [
        ...prev,
        { id: crypto.randomUUID(), name: f.name, kind: 'text', content, mime: 'text/plain' },
      ]);
    }
  };

  // Busca categorias reais do usuário
  const { data: categorias = [], isLoading: isLoadingCategorias } = useQuery({
    queryKey: ['categorias-for-material', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('categorias')
        .select('id, nome, cor')
        .eq('user_id', user.id)
        .order('nome');
      if (error) throw error;
      return (data || []) as Categoria[];
    },
    enabled: !!user?.id && isOpen,
  });

  // Busca templates do banco
  const { data: dbTemplates = [], isLoading: isLoadingDbTemplates } = useQuery({
    queryKey: ['proposal-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposal_templates')
        .select('id, template_id, name, description, tags, preview_html_path')
        .eq('is_active', true);

      if (error && error.code !== '42P01') {
        console.error('Erro ao buscar templates:', error);
      }
      return (data || []) as DbTemplate[];
    },
    enabled: isOpen,
  });

  const resetModal = () => {
    setStep('method');
    setSelectedCategoria(null);
    setCustomTitle('');
    setCreationMethod(null);
    setSelectedDbTemplate(null);
    setSelectedPdf(null);
    setSelectedPacoteIds([]);
    setAiRefs([]);
  };

  const handleCloseModal = () => {
    onClose();
    resetModal();
  };

  const resolvedTitle = customTitle.trim() || selectedCategoria?.nome || '';

  const handleCreate = async () => {
    if (!resolvedTitle || !creationMethod) return;

    let initialContent: any = undefined;

    if (creationMethod === 'ai') {
      const aiPackages = (pacotes || [])
        .filter((p) => selectedPacoteIds.includes(p.id))
        .map((p) => {
          const features: string[] = [];
          if (p.fotos_incluidas) features.push(`${p.fotos_incluidas} fotos digitais`);
          if (p.duracao_minutos) {
            features.push(
              p.duracao_minutos >= 60
                ? `${Math.round((p.duracao_minutos / 60) * 10) / 10}h de sessão`
                : `${p.duracao_minutos} min de sessão`
            );
          }
          for (const inc of p.produtosIncluidos || []) {
            const prod = (produtos || []).find((pr) => pr.id === inc.produtoId);
            if (prod?.nome) features.push(`${inc.quantidade ?? 1}x ${prod.nome}`);
          }
          return {
            name: p.nome,
            price: p.valor_base != null ? `R$ ${Number(p.valor_base).toLocaleString('pt-BR')}` : '',
            features,
          };
        });

      const refFiles = aiRefs.filter((r) => (r.kind === 'image' || r.kind === 'pdf') && r.url);
      const refTexts = aiRefs.filter((r) => r.kind === 'text' && r.content);

      const generated = await generate({
        ...briefing,
        photographer_name: briefing.photographer_name || undefined,
        packages: aiPackages.length > 0 ? aiPackages : undefined,
        references:
          refFiles.length > 0
            ? refFiles.map((r) => ({ url: r.url!, mime_type: r.mime, name: r.name }))
            : undefined,
        reference_texts:
          refTexts.length > 0
            ? refTexts.map((r) => ({ name: r.name, content: r.content! }))
            : undefined,
      });

      if (!generated) {
        toast.error('Não foi possível gerar a proposta com IA. Tente novamente ou use um modelo.');
        return;
      }

      initialContent = generated.design_tokens
        ? [...generated.blocks, { type: 'global_settings', data: { design_tokens: generated.design_tokens } }]
        : generated.blocks;
    } else if (creationMethod === 'db-template' && selectedDbTemplate) {
      createMaterial.mutate(
        {
          title: resolvedTitle,
          categoria_id: selectedCategoria?.id,
          template_id: selectedDbTemplate.template_id,
        },
        {
          onSuccess: (data) => {
            handleCloseModal();
            navigate(`/app/comercial/construtor/${data.id}`);
          },
        }
      );
      return;
    } else if (creationMethod === 'pdf' && selectedPdf) {
      try {
        setIsUploadingPdf(true);
        const result = await gestaoR2Upload({ file: selectedPdf, context: 'proposals-pdf' });
        const pdfUrl = result.url || `https://documents.lunarihub.com/${result.storagePath}`;
        initialContent = { type: 'pdf', url: pdfUrl };
      } catch (err) {
        console.error(err);
        toast.error('Erro ao fazer upload do PDF.');
        setIsUploadingPdf(false);
        return;
      } finally {
        setIsUploadingPdf(false);
      }
    }

    createMaterial.mutate(
      {
        title: resolvedTitle,
        categoria_id: selectedCategoria?.id,
        initialContent,
      },
      {
        onSuccess: (data) => {
          handleCloseModal();
          navigate(`/app/comercial/construtor/${data.id}`);
        },
      }
    );
  };

  return {
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
    isUploadingPdf,
    categorias,
    isLoadingCategorias,
    dbTemplates,
    isLoadingDbTemplates,
    resetModal,
    handleCloseModal,
    handleCreate,
    isPendingCreate: createMaterial.isPending,
    isGenerating,
    profile,
    pacotes,
  };
}
