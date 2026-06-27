import React from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Eye, Image as ImageIcon, ExternalLink } from "lucide-react";
import { EXTERNAL_URLS } from "@/config/externalUrls";

interface Galeria {
  id: string;
  tipo: string;
  status: string;
}

interface Props {
  compact?: boolean;
  galerias: Galeria[];
  hasGalerias: boolean;
  temSelecao: boolean;
  temEntrega: boolean;
  temTodas: boolean;
  onCreateSelecao: () => void;
  onCreateEntrega: () => void;
}

const getGaleriaTipoLabel = (tipo: string) => {
  if (tipo === "entrega" || tipo === "transfer") return "Entrega";
  return "Seleção";
};

/**
 * Botões de criar/ver galerias usados no card colapsado (Onda 5c).
 */
export function CardGalleryButtons({
  compact = false,
  galerias,
  hasGalerias,
  temSelecao,
  temEntrega,
  temTodas,
  onCreateSelecao,
  onCreateEntrega,
}: Props) {
  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {!temTodas && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size={compact ? "sm" : "default"}
              className={compact ? "h-6 px-2 text-[10px] gap-1" : "h-7 px-2.5 text-xs gap-1"}
            >
              <Plus className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
              Criar
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="end" side="bottom">
            {!temSelecao && (
              <button
                onClick={onCreateSelecao}
                className="w-full text-left px-3 py-2 text-xs rounded hover:bg-muted transition-colors flex items-center gap-2"
              >
                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                Galeria de Seleção
              </button>
            )}
            {!temEntrega && (
              <button
                onClick={onCreateEntrega}
                className="w-full text-left px-3 py-2 text-xs rounded hover:bg-muted transition-colors flex items-center gap-2"
              >
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                Galeria de Entrega
              </button>
            )}
          </PopoverContent>
        </Popover>
      )}

      {hasGalerias && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size={compact ? "sm" : "default"}
              className={compact ? "h-6 px-1.5 text-[10px] gap-0.5" : "h-7 px-2 text-xs gap-1"}
            >
              <Eye className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
              Ver
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-1" align="end" side="bottom">
            {galerias.map((g) => (
              <button
                key={g.id}
                onClick={() =>
                  window.open(
                    `${EXTERNAL_URLS.GALLERY.BASE}/gallery/${g.id}`,
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
                className="w-full text-left px-3 py-2 text-xs rounded hover:bg-muted transition-colors flex items-center justify-between gap-2"
              >
                <span className="font-medium">{getGaleriaTipoLabel(g.tipo)}</span>
                <span className="text-[10px] text-muted-foreground capitalize">
                  {g.status.replace("_", " ")}
                </span>
              </button>
            ))}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
