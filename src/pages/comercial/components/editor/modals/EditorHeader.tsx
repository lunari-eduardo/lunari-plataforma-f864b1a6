import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Loader2,
  ArrowLeft,
  Monitor,
  Smartphone,
  Maximize,
  MoreHorizontal,
  Save,
  UploadCloud,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Layers,
  PanelRight,
  Copy as CopyIcon,
  Link as LinkIcon,
  LayoutTemplate,
  MessageCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { MaterialEditorState } from '@/hooks/useMaterialEditor';

interface EditorHeaderProps {
  state: MaterialEditorState;
  hasChanges: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  viewMode: 'desktop' | 'mobile';
  setViewMode: (mode: 'desktop' | 'mobile') => void;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onUpdateTitle: (title: string) => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  onDiscardChanges: () => void;
  onUpdateGlobalSettings: (settings: any) => void;
  onOpenPreview: () => void;
  onOpenDuplicate: () => void;
  onOpenSlugModal: () => void;
  onOpenTemplateModal: () => void;
  onOpenMobileStructure: () => void;
  onOpenMobileProperties: () => void;
  hasActiveBlock: boolean;
}

export function EditorHeader({
  state,
  hasChanges,
  saveStatus,
  viewMode,
  setViewMode,
  zoom,
  setZoom,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onUpdateTitle,
  onSaveDraft,
  onPublish,
  onDiscardChanges,
  onUpdateGlobalSettings,
  onOpenPreview,
  onOpenDuplicate,
  onOpenSlugModal,
  onOpenTemplateModal,
  onOpenMobileStructure,
  onOpenMobileProperties,
  hasActiveBlock,
}: EditorHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="relative flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
      {/* Esquerda: Navegação e Status */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/app/comercial/biblioteca')}
          title="Voltar para a Biblioteca"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="h-4 w-px bg-border" />

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground font-medium hidden sm:inline-block">
              Comercial / Biblioteca /
            </span>
            <Input
              value={state.title}
              onChange={(e) => onUpdateTitle(e.target.value)}
              className="h-7 w-[200px] sm:w-[300px] border-transparent bg-transparent px-1 font-semibold text-foreground shadow-none hover:bg-muted/50 focus-visible:ring-1 p-0 -ml-1 text-sm"
              placeholder="Título do Material"
            />
          </div>

          <span className="text-[11px] font-medium flex items-center gap-1.5 mt-0.5">
            {saveStatus === 'saving' ? (
              <span className="text-muted-foreground flex items-center">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Salvando...
              </span>
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

      {/* Centro: Toggles de Visualização + Zoom */}
      <div className="absolute left-1/2 top-3 -translate-x-1/2 flex items-center gap-2">
        <div className="flex items-center bg-muted/50 rounded-lg p-0.5 border border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('desktop')}
            className={cn(
              'h-8 px-3 rounded-md',
              viewMode === 'desktop' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Monitor className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('mobile')}
            className={cn(
              'h-8 px-3 rounded-md',
              viewMode === 'mobile' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
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
        <Button variant="outline" size="sm" className="gap-2" onClick={onOpenMobileStructure}>
          <Layers className="h-4 w-4" />
          Estrutura
        </Button>
        {hasActiveBlock && (
          <Button variant="outline" size="sm" className="gap-2" onClick={onOpenMobileProperties}>
            <PanelRight className="h-4 w-4" />
            Editar
          </Button>
        )}
      </div>

      {/* Direita: Ações */}
      <div className="flex items-center gap-2">
        {state.format === 'blocks' && (
          <div className="hidden sm:flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onUndo}
              disabled={!canUndo}
              title="Desfazer (Ctrl+Z)"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onRedo}
              disabled={!canRedo}
              title="Refazer (Ctrl+Shift+Z)"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>
        )}

        <Button variant="outline" size="sm" className="gap-2" onClick={onOpenPreview}>
          <span className="hidden sm:inline">Pré-visualizar</span>
          <Maximize className="h-3.5 w-3.5" />
        </Button>

        {hasChanges ? (
          <>
            <Button
              variant="default"
              size="sm"
              onClick={onSaveDraft}
              className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm gap-2"
            >
              <Save className="h-3.5 w-3.5" />
              Salvar Rascunho
            </Button>
            <Button size="sm" onClick={onPublish} className="gap-2 bg-primary">
              <UploadCloud className="h-3.5 w-3.5" />
              Publicar Versão
            </Button>
          </>
        ) : (
          !state.isPublished && (
            <Button size="sm" onClick={onPublish} className="gap-2 bg-primary">
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
            <DropdownMenuItem onClick={onSaveDraft} disabled={!hasChanges} className="gap-2">
              <Save className="h-4 w-4" /> Salvar Rascunho
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" onClick={onOpenDuplicate}>
              <CopyIcon className="h-4 w-4" /> Duplicar Proposta
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenSlugModal} className="gap-2">
              <LinkIcon className="h-4 w-4" /> Personalizar Link Público
            </DropdownMenuItem>
            {state.format === 'blocks' && (
              <DropdownMenuItem onClick={onOpenTemplateModal} className="gap-2">
                <LayoutTemplate className="h-4 w-4" /> Salvar como Modelo
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={!state.globalSettings?.hideWhatsApp}
              onCheckedChange={(checked) => onUpdateGlobalSettings({ hideWhatsApp: !checked })}
              className="gap-2 cursor-pointer"
            >
              <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
              Botão Flutuante do WhatsApp
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDiscardChanges} disabled={!hasChanges} className="gap-2 text-destructive">
              Descartar Alterações
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
