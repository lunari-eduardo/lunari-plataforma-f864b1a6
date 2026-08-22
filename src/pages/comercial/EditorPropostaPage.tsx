import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMaterialEditor } from '@/hooks/useMaterialEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowLeft, Monitor, Smartphone, Maximize, MoreHorizontal, Save, Eye, X, UploadCloud, Upload, CheckCircle2, MessageCircle, Link as LinkIcon, Copy as CopyIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useMaterials } from '@/hooks/useMaterials';
import { Layers, PanelRight, ZoomIn, ZoomOut, Undo2, Redo2, MousePointerClick, LayoutTemplate } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { EditorSidebar } from './components/editor/EditorSidebar';
import { PropertiesSidebar } from './components/editor/PropertiesSidebar';
import { VisualRenderer } from './components/editor/VisualRenderer';
import { FileText } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useMaterialPublicLink } from '@/hooks/useMaterialPublicLink';
import { useR2Upload } from '@/hooks/useR2Upload';
import { supabase } from '@/integrations/supabase/client';

export default function EditorMaterialPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const editor = useMaterialEditor(id || '');
  const { duplicateMaterial } = useMaterials();
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [mobilePanel, setMobilePanel] = useState<'none' | 'structure' | 'properties'>('none');

  // Salvar como modelo (proposal_templates)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  const handleSaveAsTemplate = async () => {
    const editorNow = editor.state;
    if (!editorNow || !templateName.trim()) return;
    setIsSavingTemplate(true);
    try {
      const baseSlug = templateName.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || 'modelo';
      const { error } = await (supabase as any)
        .from('proposal_templates')
        .insert({
          template_id: `${baseSlug}-${crypto.randomUUID().slice(0, 6)}`,
          name: templateName.trim(),
          description: `Modelo salvo da proposta "${editorNow.title}".`,
          tags: [],
          blocks_json: [...editorNow.blocks, { type: 'global_settings', data: editorNow.globalSettings }],
          design_tokens: editorNow.globalSettings?.design_tokens ?? null,
          is_active: true,
        });
      if (error) throw error;
      toast.success('Modelo salvo! Ele aparece na galeria do wizard "Escolher Modelo".');
      setIsTemplateModalOpen(false);
      setTemplateName('');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao salvar modelo: ' + (err?.message || 'tente novamente'));
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const editorState = editor.state;
  const editorHasChanges = editor.hasChanges;
  const editorSaveStatus = editor.saveStatus;
  const editorSaveDraft = editor.saveDraft;
  const editorUndo = editor.undo;
  const editorRedo = editor.redo;
  const inlineEditing = viewMode === 'desktop' && editorState?.format === 'blocks';

  // Atalhos de teclado: undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) editorRedo();
        else editorUndo();
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault();
        editorRedo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editorUndo, editorRedo]);

  // Autosave: debounce 2.5s após a última mudança
  useEffect(() => {
    if (!editorHasChanges || editorSaveStatus === 'saving') return;
    const timer = setTimeout(() => {
      editorSaveDraft();
    }, 2500);
    return () => clearTimeout(timer);
  }, [editorHasChanges, editorState, editorSaveStatus, editorSaveDraft]);

  const publicLink = useMaterialPublicLink(id);
  const [isSlugModalOpen, setIsSlugModalOpen] = useState(false);
  const [slugInput, setSlugInput] = useState('');

  const openSlugModal = () => {
    if (publicLink.data?.slug) {
      setSlugInput(publicLink.data.slug);
      setIsSlugModalOpen(true);
      return;
    }
    // Sem link ainda: gera um e já abre a personalização
    publicLink.generateLink.mutate(undefined, {
      onSuccess: (link) => {
        setSlugInput(link.slug);
        setIsSlugModalOpen(true);
      }
    });
  };

  const { uploadFile, uploading: isUploadingPdf } = useR2Upload({
    context: 'proposals-pdf',
    onSuccess: (result) => {
      editor.updatePdfUrl(result.url);
      toast.success('PDF atualizado! Lembre-se de salvar o rascunho.');
    }
  });

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await uploadFile(file);
    // Limpa o input
    e.target.value = '';
  };

  if (editor.isLoading || !editor.state) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { state, hasChanges } = editor;
  const activeBlock = state.blocks[activeIndex];

  const handleSelectBlock = (index: number) => setActiveIndex(index);

  const handleAddBlock = (type: string) => {
    editor.addBlock(type);
    setActiveIndex(state.blocks.length);
  };

  const designTokens = state.globalSettings?.design_tokens;

  const structurePanel = (
    <EditorSidebar
      blocks={state.blocks}
      activeIndex={activeIndex}
      onSelectBlock={(i) => { handleSelectBlock(i); setMobilePanel('none'); }}
      onAddBlock={handleAddBlock}
      onMoveBlock={editor.moveBlock}
      onReorderBlocks={editor.reorderBlocks}
      onApplyDesignTokens={(tokens) => editor.updateGlobalSettings({ design_tokens: tokens })}
      materialTitle={state.title}
    />
  );

  const propertiesPanel = activeBlock ? (
    <PropertiesSidebar
      block={activeBlock}
      blockIndex={activeIndex}
      onUpdateBlock={editor.updateBlock}
      onUpdateDesignTokens={editor.updateDesignTokens}
      aiContext={{ materialTitle: state.title, designTokens: state.globalSettings?.design_tokens }}
      onRemoveBlock={(index) => {
        const nextCount = state.blocks.length - 1;
        editor.removeBlock(index);
        setActiveIndex((prev) => prev > index ? prev - 1 : Math.min(prev, Math.max(0, nextCount - 1)));
      }}
    />
  ) : (
    <div className="flex-1 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
      Selecione uma seção para editar suas propriedades.
    </div>
  );

  return (
    <>
      <div className="flex h-screen w-full flex-col bg-muted/30 overflow-hidden">
        {/* TOPBAR */}
        <header className="relative flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
          {/* Esquerda: Navegação e Status */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/app/comercial/biblioteca')} title="Voltar para a Biblioteca">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            
            <div className="h-4 w-px bg-border" />
            
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground font-medium hidden sm:inline-block">Comercial / Biblioteca /</span>
                <Input
                  value={state.title}
                  onChange={(e) => editor.updateTitle(e.target.value)}
                  className="h-7 w-[200px] sm:w-[300px] border-transparent bg-transparent px-1 font-semibold text-foreground shadow-none hover:bg-muted/50 focus-visible:ring-1 p-0 -ml-1 text-sm"
                  placeholder="Título do Material"
                />
              </div>
              
              <span className="text-[11px] font-medium flex items-center gap-1.5 mt-0.5">
                {editor.saveStatus === 'saving' ? (
                  <span className="text-muted-foreground flex items-center"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Salvando...</span>
                ) : hasChanges ? (
                  <span className="text-amber-600 flex items-center gap-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-amber-600 animate-pulse" />
                    Alterações não salvas
                  </span>
                ) : (
                  <span className="text-muted-foreground">Rascunho salvo</span>
                )}
              </span>
            </div>
          </div>
          
          {/* Centro: Toggles de Visualização + Zoom (desktop) */}
          <div className="absolute left-1/2 top-3 -translate-x-1/2 flex items-center gap-2">
            <div className="flex items-center bg-muted/50 rounded-lg p-0.5 border border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('desktop')}
                className={cn("h-8 px-3 rounded-md", viewMode === 'desktop' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                <Monitor className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('mobile')}
                className={cn("h-8 px-3 rounded-md", viewMode === 'mobile' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                <Smartphone className="h-4 w-4" />
              </Button>
            </div>

            {state.format === 'blocks' && viewMode === 'desktop' && (
              <div className="hidden md:flex items-center bg-muted/50 rounded-lg p-0.5 border border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 rounded-md text-muted-foreground hover:text-foreground"
                  disabled={zoom <= 0.5}
                  onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                  title="Reduzir zoom"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-[11px] font-medium text-muted-foreground w-10 text-center select-none">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 rounded-md text-muted-foreground hover:text-foreground"
                  disabled={zoom >= 1}
                  onClick={() => setZoom((z) => Math.min(1, +(z + 0.25).toFixed(2)))}
                  title="Ampliar zoom"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Esquerda (mobile/tablet): botões dos painéis em drawer */}
          <div className="flex lg:hidden items-center gap-1">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setMobilePanel('structure')}>
              <Layers className="h-4 w-4" />
              Estrutura
            </Button>
            {activeBlock && (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setMobilePanel('properties')}>
                <PanelRight className="h-4 w-4" />
                Editar
              </Button>
            )}
          </div>

          {/* Direita: Ações */}
          <div className="flex items-center gap-2">
            {state.format === 'blocks' && (
              <div className="hidden sm:flex items-center gap-0.5">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={editor.undo} disabled={!editor.canUndo} title="Desfazer (Ctrl+Z)">
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={editor.redo} disabled={!editor.canRedo} title="Refazer (Ctrl+Shift+Z)">
                  <Redo2 className="h-4 w-4" />
                </Button>
              </div>
            )}

            <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsPreviewOpen(true)}>
              <span className="hidden sm:inline">Pré-visualizar</span>
              <Maximize className="h-3.5 w-3.5" />
            </Button>

            {hasChanges ? (
              <>
                <Button variant="default" size="sm" onClick={editor.saveDraft} className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm gap-2">
                  <Save className="h-3.5 w-3.5" />
                  Salvar Rascunho
                </Button>
                <Button size="sm" onClick={editor.publish} className="gap-2 bg-primary">
                  <UploadCloud className="h-3.5 w-3.5" />
                  Publicar Versão
                </Button>
              </>
            ) : (
              !state.isPublished && (
                <Button size="sm" onClick={editor.publish} className="gap-2 bg-primary">
                  <UploadCloud className="h-3.5 w-3.5" />
                  Publicar Versão
                </Button>
              )
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 ml-1">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={editor.saveDraft} disabled={!hasChanges} className="gap-2">
                  <Save className="h-4 w-4" /> Salvar Rascunho
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2" onClick={() => {
                  if (!id) return;
                  duplicateMaterial.mutate(id, {
                    onSuccess: (newMaterial) => {
                      navigate(`/app/comercial/construtor/${newMaterial.id}`);
                    }
                  });
                }}>
                  <CopyIcon className="h-4 w-4" /> Duplicar Proposta
                </DropdownMenuItem>
                <DropdownMenuItem onClick={openSlugModal} className="gap-2">
                  <LinkIcon className="h-4 w-4" /> Personalizar Link Público
                </DropdownMenuItem>
                {state.format === 'blocks' && (
                  <DropdownMenuItem onClick={() => { setTemplateName(`${state.title} (modelo)`); setIsTemplateModalOpen(true); }} className="gap-2">
                    <LayoutTemplate className="h-4 w-4" /> Salvar como Modelo
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={!state.globalSettings?.hideWhatsApp}
                  onCheckedChange={(checked) => editor.updateGlobalSettings({ hideWhatsApp: !checked })}
                  className="gap-2 cursor-pointer"
                >
                  <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
                  Botão Flutuante do WhatsApp
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={editor.discardChanges} disabled={!hasChanges} className="gap-2 text-destructive">
                  Descartar Alterações
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* WORKSPACE (3 COLUNAS ou 1 COLUNA dependendo do formato) */}
        <main className="flex flex-1 overflow-hidden relative">
          
          {state.format === 'blocks' ? (
            <>
              {/* COLUNA ESQUERDA: ESTRUTURA (≥lg) */}
              <div className="hidden lg:flex w-[280px] shrink-0 border-r bg-background flex-col z-10">
                {structurePanel}
              </div>

              {/* COLUNA CENTRAL: RENDERIZADOR VISUAL */}
              <div className="flex-1 overflow-y-auto bg-muted/30 relative flex justify-center custom-scrollbar">
                {inlineEditing && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/90 border border-border shadow-sm text-[11px] text-muted-foreground pointer-events-none">
                    <MousePointerClick className="h-3 w-3" />
                    Clique para selecionar · Duplo clique para editar o texto
                  </div>
                )}
                <div className="w-full h-full" style={viewMode === 'desktop' && zoom !== 1 ? { zoom } : undefined}>
                  <VisualRenderer
                    blocks={state.blocks}
                    activeIndex={activeIndex}
                    onSelectBlock={handleSelectBlock}
                    viewMode={viewMode}
                    designTokens={designTokens}
                    inlineEditing={inlineEditing}
                    onUpdateField={editor.updateBlockField}
                  />
                </div>
              </div>

              {/* COLUNA DIREITA: PROPRIEDADES (≥lg) */}
              <div className="hidden lg:flex w-[340px] shrink-0 border-l bg-background flex-col shadow-[-4px_0_24px_rgba(0,0,0,0.02)] z-10">
                {propertiesPanel}
              </div>
            </>
          ) : (
            <div className="flex-1 w-full h-full flex flex-col items-center justify-center p-8 bg-muted/20">
              <div className="bg-background border border-border rounded-xl p-8 max-w-md text-center shadow-sm">
                <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
                  <FileText className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Proposta em PDF</h3>
                <p className="text-muted-foreground mb-6">
                  Este material é um arquivo PDF estático. Você não pode editá-lo pelo construtor de blocos.
                </p>
                <div className="flex gap-4 justify-center">
                  <Button variant="outline" onClick={() => window.open(state.pdfUrl, '_blank')}>
                    Ver Arquivo Atual
                  </Button>
                  <Button className="relative" disabled={isUploadingPdf}>
                    {isUploadingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    Substituir Arquivo
                    <input 
                      type="file" 
                      accept=".pdf" 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                      onChange={handlePdfUpload}
                      disabled={isUploadingPdf}
                    />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* DRAWERS DE ESTRUTURA/PROPRIEDADES (abaixo de lg) */}
      <Sheet open={mobilePanel === 'structure'} onOpenChange={(open) => !open && setMobilePanel('none')}>
        <SheetContent side="left" className="w-[300px] sm:w-[320px] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Estrutura da Proposta</SheetTitle>
          </SheetHeader>
          {structurePanel}
        </SheetContent>
      </Sheet>

      <Sheet open={mobilePanel === 'properties'} onOpenChange={(open) => !open && setMobilePanel('none')}>
        <SheetContent side="right" className="w-[340px] sm:w-[380px] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Propriedades da Seção</SheetTitle>
          </SheetHeader>
          {propertiesPanel}
        </SheetContent>
      </Sheet>

      {/* MODAL FULLSCREEN PREVIEW */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col overflow-hidden animate-in fade-in">
          <div className="h-14 border-b bg-background/50 flex items-center justify-between px-6 shrink-0">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">Pré-visualização: {state.title}</span>
            </div>
            
            {/* Toggle no meio do preview também */}
            <div className="flex items-center bg-muted/50 rounded-lg p-0.5 border border-border">
              <Button 
                variant="ghost" size="sm" 
                onClick={() => setViewMode('desktop')}
                className={cn("h-8 px-3 rounded-md", viewMode === 'desktop' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}
              >
                <Monitor className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" size="sm"
                onClick={() => setViewMode('mobile')}
                className={cn("h-8 px-3 rounded-md", viewMode === 'mobile' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}
              >
                <Smartphone className="h-4 w-4" />
              </Button>
            </div>

            <Button variant="ghost" size="sm" onClick={() => setIsPreviewOpen(false)} className="gap-2">
              Fechar Preview <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Renderiza VisualRenderer ou Iframe para Preview */}
          <div className="flex-1 overflow-y-auto bg-muted/30 flex justify-center py-8">
            {state.format === 'blocks' ? (
               <VisualRenderer
                blocks={state.blocks}
                activeIndex={-1}
                onSelectBlock={() => {}}
                viewMode={viewMode}
                mode="public"
                designTokens={designTokens}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-background">
                <iframe
                  className="w-full h-full max-w-[1200px] border-none bg-white shadow-xl"
                  title="PDF Preview"
                  src={`${state.pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL SALVAR COMO MODELO */}
      <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Salvar como Modelo</DialogTitle>
            <DialogDescription>
              O conteúdo atual desta proposta (blocos + paleta) fica disponível como modelo no wizard de criação.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="template-name" className="text-sm font-medium">Nome do modelo</label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Ex: Gestante Premium"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsTemplateModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSaveAsTemplate}
              disabled={!templateName.trim() || isSavingTemplate}
              className="gap-2"
            >
              {isSavingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <LayoutTemplate className="h-4 w-4" />}
              Salvar Modelo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL PERSONALIZAR SLUG */}
      <Dialog open={isSlugModalOpen} onOpenChange={setIsSlugModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Personalizar Link Público</DialogTitle>
            <DialogDescription>
              Crie um endereço amigável para este material. O endereço atual continuará funcionando.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="slug" className="text-sm font-medium">Link personalizado</label>
              <div className="flex items-center rounded-md border border-input bg-transparent px-3 py-1 shadow-sm focus-within:ring-1 focus-within:ring-ring">
                <span className="text-muted-foreground text-sm select-none truncate max-w-[120px]">{window.location.host}/</span>
                <input
                  id="slug"
                  value={slugInput}
                  onChange={(e) => setSlugInput(e.target.value)}
                  className="flex h-8 w-full rounded-md bg-transparent text-sm shadow-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="ex: gestante-maria"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsSlugModalOpen(false)}>Cancelar</Button>
            <Button 
              onClick={() => {
                publicLink.updateSlug.mutate(slugInput, {
                  onSuccess: () => setIsSlugModalOpen(false)
                });
              }}
              disabled={!slugInput.trim() || publicLink.updateSlug.isPending || slugInput === publicLink.data?.slug}
              className="gap-2"
            >
              {publicLink.updateSlug.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Salvar Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
