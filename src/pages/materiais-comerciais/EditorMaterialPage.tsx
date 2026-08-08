import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMaterialEditor, BlockData } from '@/hooks/useMaterialEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowLeft, Monitor, Smartphone, Maximize, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EditorSidebar } from './components/editor/EditorSidebar';
import { PropertiesSidebar } from './components/editor/PropertiesSidebar';
import { VisualRenderer } from './components/editor/VisualRenderer';

export default function EditorMaterialPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const editor = useMaterialEditor(id || '');
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');

  if (editor.isLoading || !editor.state) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { state } = editor;
  const activeBlock = state.blocks[activeIndex];

  const handleSelectBlock = (index: number) => setActiveIndex(index);
  
  const handleAddBlock = (type: string) => {
    editor.addBlock(type);
    setActiveIndex(state.blocks.length);
  };

  return (
    <div className="flex h-screen w-full flex-col bg-muted/30 overflow-hidden">
      {/* TOPBAR */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
        {/* Esquerda: Navegação e Status */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/app/materiais')} title="Voltar para Biblioteca">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          <div className="h-4 w-px bg-border" />
          
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground font-medium">Dashboard / Propostas /</span>
              <Input
                value={state.title}
                onChange={(e) => editor.updateTitle(e.target.value)}
                className="h-7 w-64 border-transparent bg-transparent px-1 font-semibold text-foreground shadow-none hover:bg-muted/50 focus-visible:ring-1 p-0 -ml-1 text-sm"
                placeholder="Título do Material"
              />
            </div>
            
            <span className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
              {editor.saveStatus === 'saving' && <>Salvando alterações...</>}
              {editor.saveStatus === 'saved' && <>Salvo agora há pouco</>}
              {editor.saveStatus === 'error' && <span className="text-destructive">Erro ao salvar</span>}
              {editor.saveStatus === 'idle' && <>Editável</>}
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
          <Button variant="outline" size="sm" className="gap-2">
            Pré-visualizar
            <Maximize className="h-3.5 w-3.5 ml-1" />
          </Button>
          <Button size="sm" onClick={() => editor.publish()}>
            Publicar Versão
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
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
  );
}
