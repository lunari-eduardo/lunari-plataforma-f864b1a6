import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit3, Package } from 'lucide-react';
import { formatarMoeda } from '@/utils/precificacaoUtils';
import type { Pacote, Categoria, Produto } from '@/types/configuration';

interface PacoteCardProps {
  pacote: Pacote;
  categoria: Categoria | undefined;
  produtos: Produto[];
  onEdit: (pacote: Pacote) => void;
  onDelete: (id: string) => void;
}

export default function PacoteCard({ 
  pacote, 
  categoria, 
  produtos, 
  onEdit, 
  onDelete 
}: PacoteCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const getProdutoNome = (produtoId: string) => {
    const produto = produtos.find(p => p.id === produtoId);
    return produto?.nome || 'Produto não encontrado';
  };

  const getTotalProdutos = () => {
    return pacote.produtosIncluidos.reduce((total, item) => total + item.quantidade, 0);
  };

  return (
    <Card 
      className="group relative overflow-hidden transition-all duration-200 hover:shadow-card-elevated border-lunar-border bg-card animate-fade-in"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4 text-lunar-accent flex-shrink-0" />
              <h3 className="font-medium text-sm text-foreground truncate">
                {pacote.nome}
              </h3>
            </div>
            {categoria && (
              <Badge 
                variant="secondary" 
                className="text-2xs px-2 py-0.5 bg-lunar-accent/10 text-lunar-accent border-lunar-accent/20"
              >
                {categoria.nome}
              </Badge>
            )}
          </div>
          
          {/* Actions */}
          <div className={`flex gap-1 transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-lunar-textSecondary hover:text-lunar-accent hover:bg-lunar-accent/10"
              onClick={() => onEdit(pacote)}
            >
              <Edit3 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-lunar-textSecondary hover:text-destructive hover:bg-destructive/10"
              onClick={() => onDelete(pacote.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Pricing */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <span className="text-2xs text-muted-foreground block mb-0.5">Valor Base</span>
            <span className="text-sm font-medium text-foreground">
              {formatarMoeda(pacote.valor_base)}
            </span>
          </div>
          <div>
            <span className="text-2xs text-muted-foreground block mb-0.5">Foto Extra</span>
            <span className="text-sm font-medium text-foreground">
              {formatarMoeda(pacote.valor_foto_extra || 0)}
            </span>
          </div>
        </div>

        {/* Products Summary */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-2xs text-muted-foreground">Produtos Incluídos</span>
            <Badge variant="outline" className="text-2xs px-1.5 py-0.5">
              {getTotalProdutos()} itens
            </Badge>
          </div>
          
          {pacote.produtosIncluidos.length > 0 ? (
            <div className="space-y-1">
              {pacote.produtosIncluidos.slice(0, 2).map((item) => (
                <div key={item.produtoId} className="flex items-center justify-between text-2xs">
                  <span className="text-muted-foreground truncate flex-1">
                    {getProdutoNome(item.produtoId)}
                  </span>
                  <span className="text-foreground font-medium ml-2">
                    {item.quantidade}x
                  </span>
                </div>
              ))}
              {pacote.produtosIncluidos.length > 2 && (
                <div className="text-2xs text-lunar-accent">
                  +{pacote.produtosIncluidos.length - 2} mais
                </div>
              )}
            </div>
          ) : (
            <div className="text-2xs text-muted-foreground italic">
              Nenhum produto incluído
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}