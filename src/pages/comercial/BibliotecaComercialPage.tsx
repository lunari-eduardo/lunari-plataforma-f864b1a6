import React, { useState, useRef } from 'react';
import { Plus, Search, BookOpen, Loader2, Sparkles, LayoutTemplate, ChevronRight, Tag, FileText, UploadCloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { MaterialCard } from './components/MaterialCard';
import { useMaterials } from '@/hooks/useMaterials';
import { useMaterialShares } from '@/hooks/useMaterialShares';
import { useSupabaseLeads } from '@/hooks/useSupabaseLeads';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Mock de conteúdo inicial gerado por IA (MVP — será substituído por IA real)
const MOCK_AI_CONTENT = [
  { type: 'cover', data: { title: 'Proposta Exclusiva', subtitle: 'Registrando momentos únicos da sua história.', btnText: 'Vamos começar' } },
  { type: 'about', data: { title: 'Por que me escolher', content: 'Minha fotografia não é apenas sobre o click, mas sobre a experiência...' } },
  { type: 'package', data: { title: 'Pacote Essencial', price_cents: 189000, description: '1h de ensaio\n20 fotos digitais\nGaleria online' } },
  { type: 'package', data: { title: 'Pacote Premium', price_cents: 249000, description: '2h de ensaio\nTodas as fotos digitais\nÁlbum 20x20', highlight: true } },
  { type: 'faq', data: { title: 'Dúvidas Comuns', content: 'Posso levar acompanhante? Sim.' } }
];

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
type Step = 'category' | 'method' | 'template-gallery' | 'pdf-upload';

export default function BibliotecaComercialPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { materials, isLoading, createMaterial, archiveMaterial, deleteMaterial, duplicateMaterial } = useMaterials();

  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Wizard state
  const [step, setStep] = useState<Step>('category');
  const [selectedCategoria, setSelectedCategoria] = useState<Categoria | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [creationMethod, setCreationMethod] = useState<'ai' | 'template' | 'db-template' | 'pdf' | null>(null);
  const [selectedDbTemplate, setSelectedDbTemplate] = useState<DbTemplate | null>(null);

  // PDF Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  // Send Modal state
  const [sendModalMaterialId, setSendModalMaterialId] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string>('none');
  const [customMessage, setCustomMessage] = useState('');
  const [generatedShare, setGeneratedShare] = useState<any>(null);

  const { leads, isLoading: isLoadingLeads } = useSupabaseLeads();
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
    setStep('category');
    setSelectedCategoria(null);
    setCustomTitle('');
    setCreationMethod(null);
    setSelectedDbTemplate(null);
    setSelectedPdf(null);
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
      initialContent = MOCK_AI_CONTENT;
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
        const fileExt = selectedPdf.name.split('.').pop();
        const fileName = `${user?.id}/${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('proposals_pdfs')
          .upload(fileName, selectedPdf);
        
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('proposals_pdfs')
          .getPublicUrl(fileName);

        initialContent = { type: 'pdf', url: publicUrl };
      } catch (err) {
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
    if (!sendModalMaterialId) return;
    createShare.mutate(
      { 
        lead_id: selectedLeadId === 'none' ? undefined : selectedLeadId, 
        custom_message: customMessage 
      },
      {
        onSuccess: (data) => {
          setGeneratedShare(data);
        }
      }
    );
  };

  const filteredMaterials = (materials || []).filter(m =>
    m.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto min-h-[calc(100vh-4rem)]">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Biblioteca de Materiais</h1>
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
              isActive={material.status === 'active'}
              isPublished={!!material.current_version?.published_at}
              coverUrl={material.cover_image_url}
              onOpen={handleOpenEditor}
              onArchive={() => archiveMaterial.mutate(material.id)}
              onDelete={() => deleteMaterial.mutate(material.id)}
              onSend={handleOpenSendModal}
              onDuplicate={(id) => duplicateMaterial.mutate(id)}
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
              {step === 'category' && 'Selecione a categoria para este material comercial.'}
              {step === 'method' && 'Escolha como deseja iniciar a criação.'}
              {step === 'template-gallery' && 'Escolha um modelo premium para iniciar.'}
              {step === 'pdf-upload' && 'Faça o upload do seu arquivo PDF estático.'}
            </DialogDescription>
          </DialogHeader>

          {/* ─── PASSO 1: Selecionar Categoria ─── */}
          {step === 'category' && (
            <div className="py-4 space-y-4">
              {isLoadingCategorias ? (
                <div className="grid grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
                </div>
              ) : categorias.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <Tag className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Você ainda não cadastrou categorias.<br />
                    Acesse <strong>Configurações</strong> para criar sua primeira categoria.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                  {categorias.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategoria(cat)}
                      className={cn(
                        'flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all',
                        selectedCategoria?.id === cat.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card hover:border-primary/40 hover:bg-muted/40'
                      )}
                    >
                      <span
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: cat.cor || '#6b7280' }}
                      />
                      <span className="font-medium text-sm text-foreground truncate">{cat.nome}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Nome personalizado (opcional) */}
              {selectedCategoria && (
                <div className="space-y-2 animate-in slide-in-from-top-2 fade-in duration-200 pt-1">
                  <label className="text-sm font-medium text-foreground">
                    Nome personalizado <span className="text-muted-foreground font-normal">(opcional)</span>
                  </label>
                  <Input
                    placeholder={`Ex: Proposta ${selectedCategoria.nome} — Maria Fernanda`}
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="h-11"
                    onKeyDown={(e) => { if (e.key === 'Enter' && selectedCategoria) setStep('method'); }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Se não informado, o título será <strong>"{selectedCategoria.nome}"</strong>.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ─── PASSO 2: Escolher Modo de Criação ─── */}
          {step === 'method' && (
            <div className="py-4 space-y-4 animate-in slide-in-from-right-4 fade-in duration-200">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <button
                  type="button"
                  onClick={() => setStep('category')}
                  className="hover:text-foreground transition-colors underline underline-offset-2"
                >
                  ← Voltar
                </button>
                <span>·</span>
                <span>Título: <strong className="text-foreground">{resolvedTitle}</strong></span>
              </div>

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
                    <h3 className="font-semibold text-foreground text-sm">Upload de PDF</h3>
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
                    <h3 className="font-semibold text-foreground text-sm">Em Branco</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Comece com uma estrutura limpa.
                    </p>
                  </div>
                </button>
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
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedDbTemplate(template)}
                      className={cn(
                        'flex flex-col rounded-xl border-2 overflow-hidden text-left transition-all',
                        selectedDbTemplate?.id === template.id
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-border hover:border-primary/50'
                      )}
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
                      Tamanho máximo: 10MB. O arquivo será otimizado para carregamento rápido.
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
                      if (file.size > 10 * 1024 * 1024) {
                        toast.error('O arquivo é muito grande. O limite é 10MB.');
                        return;
                      }
                      setSelectedPdf(file);
                    }
                  }}
                />
              </div>
            </div>
          )}

          <DialogFooter className="border-t pt-4">
            <Button variant="ghost" onClick={handleCloseModal}>Cancelar</Button>

            {step === 'category' && (
              <Button
                onClick={() => setStep('method')}
                disabled={!selectedCategoria}
                className="gap-2"
              >
                Continuar
                <ChevronRight size={16} />
              </Button>
            )}

            {step === 'method' && (
              <Button
                onClick={() => {
                  if (creationMethod === 'db-template') {
                    setStep('template-gallery');
                  } else if (creationMethod === 'pdf') {
                    setStep('pdf-upload');
                  } else {
                    handleCreate();
                  }
                }}
                disabled={!resolvedTitle || !creationMethod || createMaterial.isPending}
                className="gap-2"
              >
                {createMaterial.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {['db-template', 'pdf'].includes(creationMethod || '') ? 'Avançar' : (creationMethod === 'ai' ? 'Gerar Proposta' : 'Criar Proposta')}
              </Button>
            )}

            {step === 'template-gallery' && (
              <Button
                onClick={handleCreate}
                disabled={!selectedDbTemplate || createMaterial.isPending}
                className="gap-2"
              >
                {createMaterial.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Usar Modelo Selecionado
              </Button>
            )}

            {step === 'pdf-upload' && (
              <Button
                onClick={handleCreate}
                disabled={!selectedPdf || createMaterial.isPending || isUploadingPdf}
                className="gap-2"
              >
                {(createMaterial.isPending || isUploadingPdf) && <Loader2 className="h-4 w-4 animate-spin" />}
                {isUploadingPdf ? 'Enviando PDF...' : 'Concluir Criação'}
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
                  <label className="text-sm font-medium text-foreground">Vincular a um Lead (Opcional)</label>
                  <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um lead..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não vincular a nenhum lead</SelectItem>
                      {!isLoadingLeads && leads.map(lead => (
                        <SelectItem key={lead.id} value={lead.id}>
                          {lead.nome} {lead.whatsapp && `(${lead.whatsapp})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  
                  <div className="flex w-full items-center gap-2">
                    <Input 
                      readOnly 
                      value={`${window.location.origin}/p/${generatedShare.token}`} 
                      className="bg-white border-green-200 text-sm h-10"
                    />
                    <Button 
                      variant="secondary"
                      className="shrink-0 bg-white hover:bg-green-100 text-green-700 border-green-200"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/p/${generatedShare.token}`);
                        toast.success('Link copiado!');
                      }}
                    >
                      Copiar
                    </Button>
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
