import React, { useState, useRef, useEffect } from 'react';
import { Plus, Search, BookOpen, Loader2, Sparkles, LayoutTemplate, ChevronRight, Tag, FileText, UploadCloud, Archive, Check, ChevronsUpDown, Trash2, X, Image as ImageIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MaterialCard } from './components/MaterialCard';
import { useMaterials } from '@/hooks/useMaterials';
import { useMaterialShares } from '@/hooks/useMaterialShares';
import { useSupabaseLeads } from '@/hooks/useSupabaseLeads';
import { useClientesRealtime } from '@/hooks/useClientesRealtime';
import { supabase } from '@/integrations/supabase/client';
import { gestaoR2Upload } from '@/lib/gestaoR2Upload';
import { uploadProposalImage } from './blocks/uploadImage';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useConfigurationContext } from '@/contexts/ConfigurationContext';
import { useProposalGenerate, type ProposalBriefing } from '@/hooks/useProposalAI';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getPublicShareBaseUrl } from '@/utils/domainUtils';

export function formatWhatsAppNumber(phone: string): string {
  if (!phone) return '';
  let numbers = phone.replace(/\D/g, '');
  if (numbers.length === 0) return '';
  if (!numbers.startsWith('55') && numbers.length <= 11) {
    numbers = '55' + numbers;
  }
  const dddStr = numbers.substring(2, 4);
  const localNumber = numbers.substring(4);
  const ddd = parseInt(dddStr, 10);
  if (ddd > 28 && localNumber.length === 9 && localNumber.startsWith('9')) {
    return '55' + dddStr + localNumber.substring(1);
  }
  return numbers;
}

// (A geração de conteúdo com IA é real: edge function proposal-generate)

type Categoria = { id: string; nome: string; cor: string | null };

export type DbTemplate = {
  id: string;
  template_id: string;
  name: string;
  description: string;
  tags: string[];
  preview_html_path: string;
};

// Etapas do wizard de criação
type Step = 'category' | 'method' | 'template-gallery' | 'pdf-upload' | 'ai-briefing';

const SESSION_TYPES = ['Ensaio Gestante', 'Casamento', 'Newborn', 'Família', 'Aniversário', 'Ensaios de Casal', 'Corporativo', 'Produto', 'Outro'];
const TONES = ['Acolhedor', 'Sofisticado', 'Divertido', 'Minimalista', 'Poético'];

export default function BibliotecaComercialPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { materials, isLoading, createMaterial, archiveMaterial, deleteMaterial, duplicateMaterial } = useMaterials();
  const isPendingCreate = createMaterial.isPending;

  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Wizard state
  const [step, setStep] = useState<Step>('method');
  const [selectedCategoria, setSelectedCategoria] = useState<Categoria | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [creationMethod, setCreationMethod] = useState<'ai' | 'template' | 'db-template' | 'pdf' | null>(null);
  const [selectedDbTemplate, setSelectedDbTemplate] = useState<DbTemplate | null>(null);

  // Briefing para geração com IA
  const { generate, isGenerating } = useProposalGenerate();
  const [briefing, setBriefing] = useState<ProposalBriefing>({ session_type: 'Ensaio Gestante', tone: 'Acolhedor' });
  const [selectedPacoteIds, setSelectedPacoteIds] = useState<string[]>([]);

  // Referências de layout/design para a IA (imagens/PDF no R2, textos inline)
  type AiRef = { id: string; name: string; kind: 'image' | 'pdf' | 'text'; url?: string; content?: string; mime: string };
  const [aiRefs, setAiRefs] = useState<AiRef[]>([]);
  const [isUploadingRef, setIsUploadingRef] = useState(false);

  const addRefImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    const room = Math.max(0, 6 - aiRefs.filter((r) => r.kind === 'image').length);
    if (files.length > room) toast.info('Máximo de 6 imagens de referência.');
    setIsUploadingRef(true);
    try {
      for (const f of files.slice(0, room)) {
        if (f.size > 10 * 1024 * 1024) { toast.error(`"${f.name}" passa de 10MB.`); continue; }
        try {
          const url = await uploadProposalImage(f);
          setAiRefs((prev) => [...prev, { id: crypto.randomUUID(), name: f.name, kind: 'image', url, mime: 'image/jpeg' }]);
        } catch { toast.error(`Erro ao enviar "${f.name}".`); }
      }
    } finally {
      setIsUploadingRef(false);
    }
  };

  const addRefPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (aiRefs.some((r) => r.kind === 'pdf')) { toast.error('Envie no máximo 1 PDF de referência.'); return; }
    if (f.size > 15 * 1024 * 1024) { toast.error('O PDF passa de 15MB.'); return; }
    setIsUploadingRef(true);
    try {
      const result = await gestaoR2Upload({ file: f, context: 'proposals-pdf' });
      const url = result.url || `https://documents.lunarihub.com/${result.storagePath}`;
      setAiRefs((prev) => [...prev, { id: crypto.randomUUID(), name: f.name, kind: 'pdf', url, mime: 'application/pdf' }]);
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
      if (f.size > 300 * 1024) { toast.error(`"${f.name}" passa de 300KB.`); continue; }
      const content = await f.text();
      setAiRefs((prev) => [...prev, { id: crypto.randomUUID(), name: f.name, kind: 'text', content, mime: 'text/plain' }]);
    }
  };

  // Dados da conta: perfil (nome do estúdio) e pacotes cadastrados
  const { profile } = useUserProfile();
  const { pacotes, produtos } = useConfigurationContext();

  // Nome do fotógrafo: preenchido automaticamente com o perfil (empresa || nome)
  useEffect(() => {
    if (step === 'ai-briefing' && profile) {
      const name = (profile.empresa || profile.nome || '').trim();
      if (name) {
        setBriefing((b) => (b.photographer_name ? b : { ...b, photographer_name: name }));
      }
    }
  }, [step, profile]);

  // PDF Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  // Send Modal state
  const [sendModalMaterialId, setSendModalMaterialId] = useState<string | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string>('none');
  const [customMessage, setCustomMessage] = useState('');
  const [generatedShare, setGeneratedShare] = useState<any>(null);

  const { leads, isLoading: isLoadingLeads } = useSupabaseLeads();
  const { clientes, isLoading: isLoadingClientes } = useClientesRealtime();
  const { createShare } = useMaterialShares(sendModalMaterialId || undefined);

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
    enabled: !!user?.id && isCreateModalOpen,
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
    enabled: isCreateModalOpen,
  });

  const handleOpenEditor = (id: string) => {
    navigate(`/app/comercial/construtor/${id}`);
  };

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
    setIsCreateModalOpen(false);
    resetModal();
  };

  // O título final: personalizado prevalece; senão, nome da categoria
  const resolvedTitle = customTitle.trim() || selectedCategoria?.nome || '';

  const handleCreate = async () => {
    if (!resolvedTitle || !creationMethod) return;

    let initialContent: any = undefined;

    if (creationMethod === 'ai') {
      // Geração real por IA: briefing → worker proposal-generate → blocos V2 validados
      // Pacotes cadastrados selecionados viram inputs reais (nomes/preços da conta)
      const aiPackages = (pacotes || [])
        .filter((p) => selectedPacoteIds.includes(p.id))
        .map((p) => {
          const features: string[] = [];
          if (p.fotos_incluidas) features.push(`${p.fotos_incluidas} fotos digitais`);
          if (p.duracao_minutos) {
            features.push(p.duracao_minutos >= 60
              ? `${Math.round((p.duracao_minutos / 60) * 10) / 10}h de sessão`
              : `${p.duracao_minutos} min de sessão`);
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
        references: refFiles.length > 0 ? refFiles.map((r) => ({ url: r.url!, mime_type: r.mime, name: r.name })) : undefined,
        reference_texts: refTexts.length > 0 ? refTexts.map((r) => ({ name: r.name, content: r.content! })) : undefined,
      });
      if (!generated) {
        toast.error('Não foi possível gerar a proposta com IA. Tente novamente ou use um modelo.');
        return;
      }
      initialContent = generated.design_tokens
        ? [...generated.blocks, { type: 'global_settings', data: { design_tokens: generated.design_tokens } }]
        : generated.blocks;
    } else if (creationMethod === 'db-template' && selectedDbTemplate) {
      // Neste caso, a criação é tratada no `useMaterials.ts` passando o `template_id`
      // Mas podemos passar uma prop separada. Como o `createMaterial` atual já
      // suporta isso, iremos atualizar o payload.
      createMaterial.mutate(
        {
          title: resolvedTitle,
          categoria_id: selectedCategoria?.id,
          template_id: selectedDbTemplate.template_id
        },
        {
          onSuccess: (data) => {
            handleCloseModal();
            navigate(`/app/comercial/construtor/${data.id}`);
          }
        }
      );
      return; // Interrompe para usar o payload específico acima
    } else if (creationMethod === 'pdf' && selectedPdf) {
      try {
        setIsUploadingPdf(true);
        // Upload unificado no R2 (mesmo contexto usado na substituição dentro do editor)
        const result = await gestaoR2Upload({ file: selectedPdf, context: 'proposals-pdf' });
        // Bucket público de documentos comerciais (documents.lunarihub.com)
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
        }
      }
    );
  };

  const handleOpenSendModal = (id: string) => {
    setSendModalMaterialId(id);
    setSelectedLeadId('none');
    setCustomMessage('');
    setGeneratedShare(null);
  };

  const handleCreateShare = () => {
    let lead_id: string | undefined;
    let cliente_id: string | undefined;

    if (selectedLeadId !== 'none') {
      if (selectedLeadId.startsWith('lead_')) {
        lead_id = selectedLeadId.replace('lead_', '');
      } else if (selectedLeadId.startsWith('cliente_')) {
        cliente_id = selectedLeadId.replace('cliente_', '');
      } else {
        // Fallback for any old value that might be just a UUID
        lead_id = selectedLeadId;
      }
    }

    createShare.mutate({ 
      lead_id, 
      cliente_id,
      custom_message: customMessage 
    }, {
      onSuccess: (data) => {
        setGeneratedShare(data);
      }
    });
  };

  const filteredMaterials = (materials || []).filter(m => {
    if (!showArchived && m.status === 'archived') return false;
    if (showArchived && m.status !== 'archived') return false;
    return m.title.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto min-h-[calc(100vh-4rem)]">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Propostas</h1>
            <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100 hidden sm:inline-flex">
              Admin Only
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1 max-w-xl">
            Acompanhe o desempenho de suas propostas, contratos e portfólios compartilhados com seus clientes.
          </p>
        </div>

        <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2 shadow-sm shrink-0 bg-primary">
          <Plus size={16} />
          Nova Proposta
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-card p-2 rounded-xl border border-border shadow-sm">
        <div className="relative w-full sm:flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar material pelo título..."
            className="pl-9 bg-transparent border-none shadow-none focus-visible:ring-0"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center">
          <Button 
            variant={showArchived ? "secondary" : "ghost"} 
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
            className={showArchived ? "bg-muted" : "text-muted-foreground hover:text-foreground"}
          >
            <Archive className="mr-2 h-4 w-4" />
            {showArchived ? 'Ocultar Arquivadas' : 'Ver Arquivadas'}
          </Button>
        </div>
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
              <Skeleton className="aspect-[4/3] w-full rounded-lg" />
              <div className="flex flex-col gap-2 pt-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredMaterials.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in duration-500">
          {filteredMaterials.map((material) => (
              <MaterialCard
                key={material.id}
                id={material.id}
                title={material.title}
                lastUpdated={`Atualizado há ${formatDistanceToNow(new Date(material.updated_at), { locale: ptBR })}`}
                categoryName={material.categoria?.nome}
                isActive={material.status === 'active'}
                isPublished={!!material.current_version?.published_at}
                coverUrl={material.cover_image_url}
                onOpen={handleOpenEditor}
                onArchive={() => archiveMaterial.mutate(material.id)}
                onDelete={() => {
                  if (window.confirm(`Excluir "${material.title}" permanentemente?\n\nEsta ação exclui a proposta e todo o histórico de compartilhamentos e não pode ser desfeita.`)) {
                    deleteMaterial.mutate(material.id);
                  }
                }}
                onSend={handleOpenSendModal}
                onDuplicate={(id) => duplicateMaterial.mutate(id)}
                onViewShares={() => navigate(`/app/comercial/compartilhamentos?material=${encodeURIComponent(material.title)}`)}
              />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center border border-dashed border-border rounded-2xl bg-muted/10">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Nenhum material encontrado</h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Sua biblioteca está vazia. Comece criando uma nova proposta comercial.
          </p>
          <Button onClick={() => setIsCreateModalOpen(true)} variant="outline" className="gap-2">
            <Plus size={16} />
            Criar primeira proposta
          </Button>
        </div>
      )}

      {/* ===================== MODAL NOVA PROPOSTA ===================== */}
      <Dialog open={isCreateModalOpen} onOpenChange={(open) => { if (!open) handleCloseModal(); }}>
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
            <div className="py-4 space-y-4 animate-in slide-in-from-right-4 fade-in duration-200">

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card IA */}
                <button
                  type="button"
                  onClick={() => setCreationMethod('ai')}
                  className={cn(
                    'flex flex-col items-start gap-3 p-4 rounded-xl border-2 text-left transition-all',
                    creationMethod === 'ai'
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:border-primary/40 hover:bg-muted/50'
                  )}
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">Gerar com IA</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      A inteligência artificial cria a estrutura.
                    </p>
                  </div>
                </button>

                {/* Card Template DB */}
                <button
                  type="button"
                  onClick={() => setCreationMethod('db-template')}
                  className={cn(
                    'flex flex-col items-start gap-3 p-4 rounded-xl border-2 text-left transition-all',
                    creationMethod === 'db-template'
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:border-primary/40 hover:bg-muted/50'
                  )}
                >
                  <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <LayoutTemplate className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">Usar Modelo</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Comece com um modelo premium editável.
                    </p>
                  </div>
                </button>

                {/* Card PDF */}
                <button
                  type="button"
                  onClick={() => setCreationMethod('pdf')}
                  className={cn(
                    'flex flex-col items-start gap-3 p-4 rounded-xl border-2 text-left transition-all',
                    creationMethod === 'pdf'
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:border-primary/40 hover:bg-muted/50'
                  )}
                >
                  <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">Importar PDF</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Envie um PDF estático para ser rastreado.
                    </p>
                  </div>
                </button>

                {/* Card Em Branco */}
                <button
                  type="button"
                  onClick={() => setCreationMethod('template')}
                  className={cn(
                    'flex flex-col items-start gap-3 p-4 rounded-xl border-2 text-left transition-all',
                    creationMethod === 'template'
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:border-primary/40 hover:bg-muted/50'
                  )}
                >
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <LayoutTemplate className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">Começar do zero</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Comece com uma estrutura limpa.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ─── PASSO IA: Briefing para geração ─── */}
          {step === 'ai-briefing' && (
            <div className="py-4 space-y-4 animate-in slide-in-from-right-4 fade-in duration-200">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <button
                  type="button"
                  onClick={() => setStep('method')}
                  className="hover:text-foreground transition-colors underline underline-offset-2"
                >
                  ← Voltar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Categoria *</label>
                  {isLoadingCategorias ? (
                    <Skeleton className="h-10 w-full rounded-md" />
                  ) : (
                    <Select
                      value={selectedCategoria?.id || ''}
                      onValueChange={(val) => {
                        const cat = categorias.find((c) => c.id === val) || null;
                        setSelectedCategoria(cat);
                        if (cat) setBriefing((b) => ({ ...b, session_type: cat.nome }));
                      }}
                    >
                      <SelectTrigger className="bg-card"><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                      <SelectContent>
                        {categorias.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Título da proposta (opcional)</label>
                  <Input
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder={selectedCategoria?.nome || 'Proposta'}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipo de sessão</label>
                  <Select
                    value={briefing.session_type}
                    onValueChange={(v) => setBriefing((b) => ({ ...b, session_type: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SESSION_TYPES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tom da escrita</label>
                  <Select
                    value={briefing.tone || 'Acolhedor'}
                    onValueChange={(v) => setBriefing((b) => ({ ...b, tone: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TONES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome do cliente (opcional)</label>
                  <Input
                    value={briefing.client_name || ''}
                    onChange={(e) => setBriefing((b) => ({ ...b, client_name: e.target.value }))}
                    placeholder="Ex: Mariana"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Seu nome / estúdio</label>
                  <Input
                    value={briefing.photographer_name || ''}
                    onChange={(e) => setBriefing((b) => ({ ...b, photographer_name: e.target.value }))}
                    placeholder="Ex: Camila Ramos Fotografias"
                  />
                  {profile?.empresa && (
                    <p className="text-xs text-muted-foreground">Preenchido com o nome da sua conta.</p>
                  )}
                </div>
              </div>

              {/* Pacotes cadastrados (nomes e preços reais para a IA) */}
              {(pacotes || []).length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Usar meus pacotes cadastrados (opcional)</label>
                  <div className="flex flex-wrap gap-2">
                    {(pacotes || []).map((p) => {
                      const active = selectedPacoteIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedPacoteIds((ids) =>
                            active ? ids.filter((i) => i !== p.id) : [...ids, p.id]
                          )}
                          className={cn(
                            'rounded-full border px-3 py-1.5 text-xs transition-colors',
                            active
                              ? 'border-primary bg-primary/10 text-primary font-medium'
                              : 'border-border text-muted-foreground hover:border-primary/40'
                          )}
                        >
                          {p.nome}
                          {p.valor_base ? ` · R$ ${Number(p.valor_base).toLocaleString('pt-BR')}` : ''}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Selecionando pacotes, a IA usa nomes e preços reais em vez de inventar valores.
                  </p>
                </div>
              )}

              {/* Referências de layout/design para a IA analisar */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Referências de layout/design (opcional)</label>
                <p className="text-xs text-muted-foreground">
                  Envie prints, imagens ou PDF de propostas que você gostou. A IA analisa estrutura,
                  cores, tipografia e tom para gerar algo próximo da referência.
                </p>
                {aiRefs.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {aiRefs.map((r) => (
                      <span
                        key={r.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs max-w-full"
                      >
                        {r.kind === 'image'
                          ? <ImageIcon className="h-3 w-3 shrink-0 text-primary" />
                          : <FileText className="h-3 w-3 shrink-0 text-primary" />}
                        <span className="truncate max-w-[160px]">{r.name}</span>
                        <button
                          type="button"
                          onClick={() => setAiRefs((prev) => prev.filter((x) => x.id !== r.id))}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          title="Remover"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <label>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="hidden"
                      onChange={addRefImages}
                      disabled={isUploadingRef}
                    />
                    <span className="inline-flex h-8 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm hover:bg-accent">
                      {isUploadingRef ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <UploadCloud className="mr-2 h-3 w-3" />}
                      Imagens (até 6)
                    </span>
                  </label>
                  <label>
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={addRefPdf}
                      disabled={isUploadingRef}
                    />
                    <span className="inline-flex h-8 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm hover:bg-accent">
                      {isUploadingRef ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <UploadCloud className="mr-2 h-3 w-3" />}
                      PDF (1)
                    </span>
                  </label>
                  <label>
                    <input
                      type="file"
                      accept=".txt,.md,text/plain"
                      multiple
                      className="hidden"
                      onChange={addRefText}
                      disabled={isUploadingRef}
                    />
                    <span className="inline-flex h-8 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm hover:bg-accent">
                      <UploadCloud className="mr-2 h-3 w-3" />
                      Texto (.txt/.md)
                    </span>
                  </label>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Imagens e textos funcionam com qualquer provedor; PDF exige o provedor Gemini.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Destaques e observações</label>
                <Textarea
                  value={briefing.highlights || ''}
                  onChange={(e) => setBriefing((b) => ({ ...b, highlights: e.target.value }))}
                  placeholder="Ex: ensaio no estúdio com luz natural, 2 trocas de roupa, entrega em 10 dias, álbum incluso..."
                  className="min-h-[90px]"
                />
                <p className="text-xs text-muted-foreground">
                  A IA gera a estrutura e os textos (capa, editorial, pacotes, depoimentos e CTA).
                  Depois você edita tudo normalmente no construtor.
                </p>
              </div>
            </div>
          )}

          {/* ─── PASSO 3: Galeria de Templates do Banco ─── */}
          {step === 'template-gallery' && (
            <div className="py-4 space-y-4 animate-in slide-in-from-right-4 fade-in duration-200">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <button
                  type="button"
                  onClick={() => setStep('method')}
                  className="hover:text-foreground transition-colors underline underline-offset-2"
                >
                  ← Voltar
                </button>
              </div>

              {isLoadingDbTemplates ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
              ) : dbTemplates.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">Nenhum template premium disponível.</div>
              ) : (
                <div className="grid grid-cols-2 gap-4 max-h-[350px] overflow-y-auto pr-1">
                  {dbTemplates.map(template => (
                    <div
                      key={template.id}
                      className={cn(
                        'relative flex flex-col rounded-xl border-2 overflow-hidden text-left transition-all',
                        selectedDbTemplate?.id === template.id
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedDbTemplate(template)}
                        className="flex flex-col flex-1 text-left"
                      >
                        <div className="h-32 w-full bg-muted flex items-center justify-center border-b border-border">
                          <LayoutTemplate className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div className="p-3 bg-card">
                          <h4 className="font-medium text-sm text-foreground">{template.name}</h4>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.description}</p>
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {template.tags?.slice(0,2).map(tag => (
                              <span key={tag} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{tag}</span>
                            ))}
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        title="Desativar este modelo"
                        className="absolute top-1.5 right-1.5 h-7 w-7 rounded-md bg-background/80 border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 items-center justify-center hidden sm:flex"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!window.confirm(`Desativar o modelo "${template.name}"? Ele deixa de aparecer na galeria.`)) return;
                          const { error } = await (supabase as any)
                            .from('proposal_templates')
                            .update({ is_active: false })
                            .eq('id', template.id);
                          if (error) {
                            toast.error('Erro ao desativar modelo: ' + error.message);
                          } else {
                            toast.success('Modelo desativado.');
                            queryClient.invalidateQueries({ queryKey: ['proposal-templates'] });
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── PASSO 3B: Upload de PDF ─── */}
          {step === 'pdf-upload' && (
            <div className="py-4 space-y-4 animate-in slide-in-from-right-4 fade-in duration-200">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <button
                  type="button"
                  onClick={() => setStep('method')}
                  className="hover:text-foreground transition-colors underline underline-offset-2"
                >
                  ← Voltar
                </button>
              </div>

              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-xl bg-card">
                <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                  <UploadCloud className="h-6 w-6 text-red-600" />
                </div>
                
                {selectedPdf ? (
                  <div className="text-center">
                    <p className="font-medium text-sm">{selectedPdf.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(selectedPdf.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-4"
                      onClick={() => {
                        setSelectedPdf(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    >
                      Trocar arquivo
                    </Button>
                  </div>
                ) : (
                  <>
                    <h3 className="font-medium text-sm mb-1">Selecione o arquivo PDF</h3>
                    <p className="text-xs text-muted-foreground text-center max-w-[250px] mb-4">
                      Tamanho máximo: 50MB. O arquivo será otimizado para carregamento rápido.
                    </p>
                    <Button onClick={() => fileInputRef.current?.click()} variant="secondary">
                      Procurar Arquivo
                    </Button>
                  </>
                )}
                
                <input 
                  type="file" 
                  ref={fileInputRef}
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      const file = e.target.files[0];
                      if (file.size > 50 * 1024 * 1024) {
                        toast.error('O arquivo é muito grande. O limite é 50MB.');
                        return;
                      }
                      setSelectedPdf(file);
                    }
                  }}
                />
              </div>
            </div>
          )}

          {/* ─── PASSO FINAL: Selecionar Categoria ─── */}
          {step === 'category' && (
            <div className="py-4 space-y-6 animate-in slide-in-from-right-4 fade-in duration-200">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <button
                  type="button"
                  onClick={() => {
                    if (creationMethod === 'db-template') setStep('template-gallery');
                    else if (creationMethod === 'pdf') setStep('pdf-upload');
                    else if (creationMethod === 'ai') setStep('ai-briefing');
                    else setStep('method');
                  }}
                  className="hover:text-foreground transition-colors underline underline-offset-2"
                >
                  ← Voltar
                </button>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">
                  Selecione a Categoria
                </label>
                {isLoadingCategorias ? (
                  <Skeleton className="h-11 w-full rounded-md" />
                ) : categorias.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-4 text-center">
                    <Tag className="h-6 w-6 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Você ainda não cadastrou categorias.</p>
                  </div>
                ) : (
                  <Select
                    value={selectedCategoria?.id || ''}
                    onValueChange={(val) => setSelectedCategoria(categorias.find(c => c.id === val) || null)}
                  >
                    <SelectTrigger className="h-11 w-full bg-card">
                      <SelectValue placeholder="Escolha uma categoria..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.cor || '#6b7280' }} />
                            <span>{cat.nome}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {selectedCategoria && (
                <div className="space-y-2 pt-2 border-t border-border animate-in slide-in-from-top-2 fade-in duration-200">
                  <label className="text-sm font-medium text-foreground">
                    Nome personalizado <span className="text-muted-foreground font-normal">(opcional)</span>
                  </label>
                  <Input
                    placeholder={`Ex: Proposta ${selectedCategoria.nome} — Maria Fernanda`}
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="h-11"
                    onKeyDown={(e) => { if (e.key === 'Enter' && selectedCategoria) handleCreate(); }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Se não informado, o título será <strong>"{selectedCategoria.nome}"</strong>.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="border-t pt-4">
            <Button variant="ghost" onClick={handleCloseModal}>Cancelar</Button>

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
                {(isPendingCreate || isGenerating) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
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

      {/* ===================== MODAL ENVIAR ORÇAMENTO (SHARE) ===================== */}
      <Dialog 
        open={!!sendModalMaterialId} 
        onOpenChange={(open) => {
          if (!open) {
            setSendModalMaterialId(null);
            setGeneratedShare(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Enviar Orçamento</DialogTitle>
            <DialogDescription>
              Crie um link rastreável para enviar esta proposta. A versão atual será travada para garantir a integridade do que foi enviado.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            {!generatedShare ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Vincular a um Cliente ou Lead (Opcional)</label>
                  <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={popoverOpen}
                        className="w-full justify-between font-normal h-11"
                      >
                        {selectedLeadId !== 'none' && selectedLeadId !== ''
                          ? selectedLeadId.startsWith('lead_')
                            ? leads.find((lead) => `lead_${lead.id}` === selectedLeadId)?.nome
                            : clientes.find((cliente) => `cliente_${cliente.id}` === selectedLeadId)?.nome
                          : 'Não vincular a ninguém'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[450px] p-0" align="start">
                      <Command
                        filter={(value, search) => {
                          const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                          if (normalize(value).includes(normalize(search))) return 1;
                          return 0;
                        }}
                      >
                        <CommandInput placeholder="Buscar por nome ou número..." className="h-10" />
                        <CommandList>
                          <CommandEmpty>Nenhum contato encontrado.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="Nao vincular a ninguem"
                              onSelect={() => {
                                setSelectedLeadId('none');
                                setPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedLeadId === 'none' ? "opacity-100" : "opacity-0"
                                )}
                              />
                              Não vincular a ninguém
                            </CommandItem>
                          </CommandGroup>
                          
                          {(leads && leads.length > 0) && (
                            <CommandGroup heading="Leads (CRM)">
                              {leads.map((lead) => (
                                <CommandItem
                                  key={`lead_${lead.id}`}
                                  value={`${lead.nome} ${lead.whatsapp || ''}`}
                                  onSelect={() => {
                                    setSelectedLeadId(`lead_${lead.id}`);
                                    setPopoverOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedLeadId === `lead_${lead.id}` ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {lead.nome} {lead.whatsapp && `(${lead.whatsapp})`}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          )}

                          {(clientes && clientes.length > 0) && (
                            <CommandGroup heading="Clientes da Base">
                              {clientes.map((cliente) => (
                                <CommandItem
                                  key={`cliente_${cliente.id}`}
                                  value={`${cliente.nome} ${cliente.whatsapp || ''}`}
                                  onSelect={() => {
                                    setSelectedLeadId(`cliente_${cliente.id}`);
                                    setPopoverOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedLeadId === `cliente_${cliente.id}` ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {cliente.nome} {cliente.whatsapp && `(${cliente.whatsapp})`}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">
                    Vinculando a um lead, o Kanban será avançado automaticamente quando ele interagir com a proposta.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Mensagem Personalizada (Opcional)</label>
                  <Textarea 
                    placeholder="Deixe uma mensagem que será exibida no início da proposta..."
                    value={customMessage}
                    onChange={e => setCustomMessage(e.target.value)}
                    rows={3}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex flex-col items-center justify-center text-center gap-2">
                  <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center mb-1">
                    <Sparkles className="h-5 w-5 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-green-800">Orçamento pronto para envio!</h3>
                  <p className="text-sm text-green-700 mb-4">
                    Copie o link abaixo e envie para o seu cliente.
                  </p>
                  
                  <div className="flex flex-col w-full gap-2 mt-4">
                    <div className="flex w-full items-center gap-2">
                      <Input 
                        readOnly 
                        value={`${getPublicShareBaseUrl()}/p/${generatedShare.token}`} 
                        className="bg-white border-green-200 text-sm h-11"
                      />
                      <Button 
                        variant="secondary"
                        className="shrink-0 bg-white hover:bg-green-100 text-green-700 border-green-200 h-11 px-4"
                        onClick={() => {
                          navigator.clipboard.writeText(`${getPublicShareBaseUrl()}/p/${generatedShare.token}`);
                          toast.success('Link copiado!');
                        }}
                      >
                        Copiar
                      </Button>
                    </div>
                    
                    {(() => {
                      let phone = '';
                      if (selectedLeadId && selectedLeadId !== 'none') {
                        if (selectedLeadId.startsWith('lead_')) {
                          const lead = leads.find(l => `lead_${l.id}` === selectedLeadId);
                          if (lead?.whatsapp) phone = lead.whatsapp;
                        } else {
                          const cli = clientes.find(c => `cliente_${c.id}` === selectedLeadId);
                          if (cli?.whatsapp) phone = cli.whatsapp;
                        }
                      }
                      
                      if (!phone) return null;
                      
                      const formattedPhone = formatWhatsAppNumber(phone);
                      const linkText = encodeURIComponent(
                        (customMessage ? customMessage + "\n\n" : "") +
                        "Acesse sua proposta aqui: " +
                        `${getPublicShareBaseUrl()}/p/${generatedShare.token}`
                      );
                      const wpUrl = `https://wa.me/${formattedPhone}?text=${linkText}`;

                      return (
                        <a href={wpUrl} target="_blank" rel="noreferrer" className="w-full">
                          <Button className="w-full bg-[#25D366] hover:bg-[#20b858] text-white h-11 font-medium gap-2">
                            Enviar no WhatsApp
                          </Button>
                        </a>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            {!generatedShare ? (
              <>
                <Button variant="ghost" onClick={() => setSendModalMaterialId(null)}>Cancelar</Button>
                <Button 
                  onClick={handleCreateShare} 
                  disabled={createShare.isPending}
                  className="gap-2"
                >
                  {createShare.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Gerar Link Rastreável
                </Button>
              </>
            ) : (
              <Button onClick={() => setSendModalMaterialId(null)} className="w-full">
                Concluir
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
