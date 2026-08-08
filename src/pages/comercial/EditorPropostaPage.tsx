import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMaterialEditor } from '@/hooks/useMaterialEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowLeft, Monitor, Smartphone, Maximize, MoreHorizontal, Save, Eye, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EditorSidebar } from './components/editor/EditorSidebar';
import { PropertiesSidebar } from './components/editor/PropertiesSidebar';
import { VisualRenderer } from './components/editor/VisualRenderer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function EditorMaterialPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const editor = useMaterialEditor(id || '');
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

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

  return (
    <>
      <div className="flex h-screen w-full flex-col bg-muted/30 overflow-hidden">
        {/* TOPBAR */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
          {/* Esquerda: Navegação e Status */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/app/comercial/construtor')} title="Voltar para o Construtor">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            
            <div className="h-4 w-px bg-border" />
            
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground font-medium hidden sm:inline-block">Comercial / Construtor /</span>
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
          
          {/* Centro: Toggles de Visualização */}
          <div className="absolute left-1/2 top-3 -translate-x-1/2 flex items-center bg-muted/50 rounded-lg p-0.5 border border-border">
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

          {/* Direita: Ações */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsPreviewOpen(true)}>
              <span className="hidden sm:inline">Pré-visualizar</span>
              <Maximize className="h-3.5 w-3.5" />
            </Button>

            {/* Novo botão de Salvar Rascunho explícito quando há mudanças */}
            {hasChanges && (
              <Button variant="default" size="sm" onClick={editor.saveDraft} className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm gap-2">
                <Save className="h-3.5 w-3.5" />
                Salvar Rascunho
              </Button>
            )}

            {!hasChanges && (
              <Button size="sm" onClick={editor.publish} className="gap-2 bg-primary">
                Publicar Versão
              </Button>
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
                <DropdownMenuItem className="gap-2 text-muted-foreground" disabled>
                  Duplicar Proposta
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={editor.discardChanges} disabled={!hasChanges} className="gap-2 text-destructive">
                  Descartar Alterações
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* WORKSPACE (3 COLUNAS) */}
        <main className="flex flex-1 overflow-hidden relative">
          
          {/* COLUNA ESQUERDA: ESTRUTURA */}
          <div className="w-[280px] shrink-0 border-r bg-background flex flex-col z-10">
            <EditorSidebar
              blocks={state.blocks}
              activeIndex={activeIndex}
              onSelectBlock={handleSelectBlock}
              onAddBlock={handleAddBlock}
              onMoveBlock={editor.moveBlock}
              onReorderBlocks={editor.reorderBlocks}
            />
          </div>
          
          {/* COLUNA CENTRAL: RENDERIZADOR VISUAL */}
          <div className="flex-1 overflow-y-auto bg-muted/30 relative flex justify-center custom-scrollbar">
            <VisualRenderer 
              blocks={state.blocks}
              activeIndex={activeIndex}
              onSelectBlock={handleSelectBlock}
              viewMode={viewMode}
            />
          </div>

          {/* COLUNA DIREITA: PROPRIEDADES (EDIÇÃO CONTEXTUAL) */}
          <div className="w-[340px] shrink-0 border-l bg-background flex flex-col shadow-[-4px_0_24px_rgba(0,0,0,0.02)] z-10">
            {activeBlock ? (
               <PropertiesSidebar
                  block={activeBlock}
                  blockIndex={activeIndex}
                  onUpdateBlock={editor.updateBlock}
                  onRemoveBlock={(index) => {
                    editor.removeBlock(index);
                    if (activeIndex >= state.blocks.length - 1) {
                      setActiveIndex(Math.max(0, state.blocks.length - 2));
                    }
                  }}
               />
            ) : (
              <div className="flex-1 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
                Selecione uma seção para editar suas propriedades.
              </div>
            )}
          </div>
        </main>
      </div>

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
          
          {/* Reutiliza o VisualRenderer em modo fullscreen */}
          <div className="flex-1 overflow-y-auto bg-muted/30 flex justify-center py-8">
             <VisualRenderer 
              blocks={state.blocks}
              activeIndex={-1} // Sem bloco selecionado no preview
              onSelectBlock={() => {}}
              viewMode={viewMode}
            />
          </div>
        </div>
      )}
    </>
  );
}
