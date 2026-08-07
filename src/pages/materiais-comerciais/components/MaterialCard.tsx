import React, { useState } from 'react';
import { MoreHorizontal, Link as LinkIcon, Eye, Copy, FileText, Image as ImageIcon } from 'lucide-react';
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
  categoryName: string;
  versionStr: string;
  lastUpdated: string;
  isActive: boolean;
  coverUrl?: string;
  onEdit: (id: string) => void;
  onView: (id: string) => void;
}

export function MaterialCard({
  id,
  categoryName,
  versionStr,
  lastUpdated,
  isActive,
  coverUrl,
  onEdit,
  onView,
}: MaterialCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleCopyLink = () => {
    // Fictício por enquanto
    navigator.clipboard.writeText(`https://lunarihub.com/m/${id}`);
    toast.success('Link oficial copiado!');
  };

  return (
    <div 
      className="group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm transition-all hover:shadow-md"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Capa */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted">
        {coverUrl ? (
          <img 
            src={coverUrl} 
            alt={categoryName}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-secondary/50">
            <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}
        
        {/* Overlay escuro de proteção */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-70" />

        {/* Badge Status */}
        <div className="absolute left-3 top-3">
          {isActive ? (
            <Badge variant="default" className="bg-green-500/90 text-white hover:bg-green-500/90 border-none shadow-sm">
              Ativo
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-black/50 text-white backdrop-blur-sm border-none">
              Rascunho
            </Badge>
          )}
        </div>

        {/* Hover Action */}
        <div className={cn(
          "absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-all duration-200",
          isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
        )}>
          <Button 
            variant="secondary" 
            className="shadow-lg border border-white/20 hover:scale-105 transition-transform"
            onClick={() => onEdit(id)}
          >
            {isActive ? "Nova Versão" : "Editar Rascunho"}
          </Button>
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex items-start justify-between px-1">
        <div className="flex flex-col gap-0.5">
          <h3 className="font-semibold text-foreground text-sm line-clamp-1">{categoryName}</h3>
          <p className="text-xs text-muted-foreground">
            {versionStr} • {lastUpdated}
          </p>
        </div>

        {/* Quick Actions & Menu */}
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => onView(id)}
            title="Visualizar"
          >
            <Eye className="h-4 w-4" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={handleCopyLink}
            disabled={!isActive}
            title="Copiar Link"
          >
            <LinkIcon className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onEdit(id)}>
                <FileText className="mr-2 h-4 w-4" />
                {isActive ? "Criar Nova Versão" : "Continuar Edição"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyLink} disabled={!isActive}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar link oficial
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                Histórico de versões
              </DropdownMenuItem>
              <DropdownMenuItem>
                Relatório de conversão (IA)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                {isActive ? "Inativar material" : "Descartar rascunho"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
