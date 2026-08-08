import React, { useState } from 'react';
import { 
  MoreHorizontal, 
  Link as LinkIcon, 
  FileText, 
  Image as ImageIcon,
  History,
  Share2,
  BarChart2,
  Copy as CopyIcon,
  Archive,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface MaterialCardProps {
  id: string;
  title: string;
  lastUpdated: string;
  isActive: boolean;
  isPublished: boolean;
  coverUrl?: string | null;
  onOpen: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}

export function MaterialCard({
  id,
  title,
  lastUpdated,
  isActive,
  isPublished,
  coverUrl,
  onOpen,
  onArchive,
  onDelete
}: MaterialCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`https://lunarihub.com/m/${id}`);
    toast.success('Link oficial copiado!');
  };

  return (
    <div 
      className={cn(
        "group flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm transition-all duration-300",
        "hover:shadow-md hover:border-border/80 cursor-pointer"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onOpen(id)}
    >
      {/* Capa */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted">
        {coverUrl ? (
          <img 
            src={coverUrl} 
            alt={title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-secondary/50">
            <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}
        
        {/* Overlay escuro de proteção */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-50" />

        {/* Badge Status (Apenas se Inativo/Arquivado - Ativo é o default na biblioteca) */}
        {!isActive && (
          <div className="absolute left-3 top-3">
            <Badge variant="secondary" className="bg-black/60 text-white backdrop-blur-sm border-none shadow-sm">
              Arquivado
            </Badge>
          </div>
        )}

        {/* Quick Action Hover: Copiar Link (Botão flutuante para atrito zero, apenas se publicado) */}
        {isPublished && (
          <div className={cn(
            "absolute right-2 top-2 transition-all duration-200",
            isHovered ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none"
          )}>
            <Button 
              variant="secondary" 
              size="icon"
              className="h-8 w-8 rounded-full shadow-lg border border-white/10 hover:scale-110 bg-black/60 backdrop-blur-md text-white hover:bg-black/80 transition-all"
              onClick={handleCopyLink}
              title="Copiar Link Rápido"
            >
              <LinkIcon className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="flex flex-col gap-2 px-1">
        {/* Linha 1: Título e Menu */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <h3 className="font-semibold text-foreground text-sm line-clamp-1">{title}</h3>
            <p className="text-xs text-muted-foreground">
              {lastUpdated}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 -mr-2 -mt-1 text-muted-foreground hover:text-foreground shrink-0"
                onClick={(e) => e.stopPropagation()} // Evita abrir o editor
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
              
              {/* Navegação / Ambientes do Material */}
              <DropdownMenuItem onClick={() => onOpen(id)} className="font-medium">
                <FileText className="mr-2 h-4 w-4" />
                Editar Material
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                <History className="mr-2 h-4 w-4" />
                Histórico de Versões
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <Share2 className="mr-2 h-4 w-4" />
                Compartilhamentos
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <BarChart2 className="mr-2 h-4 w-4" />
                Analytics
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              {/* Ações Administrativas */}
              <DropdownMenuItem disabled>
                <CopyIcon className="mr-2 h-4 w-4" />
                Duplicar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onArchive(id)}>
                <Archive className="mr-2 h-4 w-4" />
                Arquivar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(id)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
