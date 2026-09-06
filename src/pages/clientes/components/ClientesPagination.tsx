import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ClientesPaginationProps {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems: number;
  pageNumbers: (number | 'ellipsis')[];
  onPageChange: (page: number) => void;
}

export const ClientesPagination: React.FC<ClientesPaginationProps> = ({
  currentPage,
  totalPages,
  itemsPerPage,
  totalItems,
  pageNumbers,
  onPageChange,
}) => {
  if (totalPages <= 1 || totalItems === 0) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <p className="text-xs text-muted-foreground">
        Mostrando {startItem}-{endItem} de {totalItems} clientes
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="h-8 gap-1 text-xs"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Anterior
        </Button>

        {pageNumbers.map((page, idx) =>
          page === 'ellipsis' ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={page}
              variant={currentPage === page ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPageChange(page)}
              className="h-8 w-8 p-0 text-xs"
            >
              {page}
            </Button>
          ),
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="h-8 gap-1 text-xs"
        >
          Próximo
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};
