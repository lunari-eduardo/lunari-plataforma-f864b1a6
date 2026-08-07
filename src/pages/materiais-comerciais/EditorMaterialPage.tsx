import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMaterialEditor, BlockData } from '@/hooks/useMaterialEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EditorSidebar } from './components/editor/EditorSidebar';
import { EditorCanvas } from './components/editor/EditorCanvas';
import { Loader2, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function EditorMaterialPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const editor = useMaterialEditor(id || '');
  const [activeIndex, setActiveIndex] = useState(0);

  if (editor.isLoading || !editor.state) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { state } = editor;
  const handleSelectBlock = (index: number) => setActiveIndex(index);
  
  const handleAddBlock = (type: string) => {
    editor.addBlock(type);
    setActiveIndex(state.blocks.length);
  };

  const activeBlock = state.blocks[activeIndex];

  return (
    <div className="flex h-screen w-full flex-col bg-gray-50">
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-white px-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/app/materiais')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Biblioteca
          </Button>
          <div className="h-4 w-px bg-gray-200" />
          <Input
            value={state.title}
            onChange={(e) => editor.updateTitle(e.target.value)}
            className="w-64 border-transparent bg-transparent px-2 shadow-none hover:border-gray-200 focus-visible:ring-0"
            placeholder="Título do Material"
          />
        </div>
        
        <div className="flex items-center gap-4">
          <span className={cn("text-sm", {
            "text-gray-400": editor.saveStatus === 'idle',
            "text-yellow-600": editor.saveStatus === 'saving',
            "text-green-600": editor.saveStatus === 'saved',
            "text-red-600": editor.saveStatus === 'error'
          })}>
            {editor.saveStatus === 'saving' && 'Salvando...'}
            {editor.saveStatus === 'saved' && 'Salvo'}
            {editor.saveStatus === 'error' && 'Erro'}
          </span>
          
          <Button size="sm" onClick={() => editor.publish()}>
            Publicar Versão
          </Button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <div className="w-64 shrink-0 border-r bg-white">
          <EditorSidebar
            blocks={state.blocks}
            activeIndex={activeIndex}
            onSelectBlock={handleSelectBlock}
            onAddBlock={handleAddBlock}
            onRemoveBlock={editor.removeBlock}
            onMoveBlock={editor.moveBlock}
          />
        </div>
        
        <div className="flex-1 overflow-y-auto bg-gray-50 p-8">
          <div className="mx-auto max-w-3xl">
            {activeBlock ? (
              <EditorCanvas
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
              <div className="flex h-[400px] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white text-gray-400">
                Adicione um bloco para começar a editar
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
