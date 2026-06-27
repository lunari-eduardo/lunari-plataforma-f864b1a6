import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { ChevronDown, Package } from "lucide-react";

interface ProductOption {
  id: string;
  nome: string;
  valor: string;
}

const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "");

interface Props {
  productOptions: ProductOption[];
  onSelect: (product: ProductOption) => void;
  /** Sinal externo para resetar dropdown quando o modal abre */
  resetSignal: boolean;
}

export function ProductSearchInput({ productOptions, onSelect, resetSignal }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number; left: number; width: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resetSignal) {
      setIsDropdownOpen(false);
      setSearchTerm("");
      setDropdownPosition(null);
    }
  }, [resetSignal]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return productOptions;
    const normalizedSearch = normalizeText(searchTerm);
    return productOptions.filter((product) =>
      normalizeText(product.nome).includes(normalizedSearch),
    );
  }, [productOptions, searchTerm]);

  const updateDropdownPosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isOutsideContainer = containerRef.current && !containerRef.current.contains(target);
      const isOutsideDropdown = !(target as Element).closest?.("[data-product-dropdown]");
      if (isOutsideContainer && isOutsideDropdown) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isDropdownOpen) return;
    const handlePositionUpdate = () => updateDropdownPosition();
    window.addEventListener("scroll", handlePositionUpdate, true);
    window.addEventListener("resize", handlePositionUpdate);
    return () => {
      window.removeEventListener("scroll", handlePositionUpdate, true);
      window.removeEventListener("resize", handlePositionUpdate);
    };
  }, [isDropdownOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if (!isDropdownOpen) {
      requestAnimationFrame(() => {
        updateDropdownPosition();
        setIsDropdownOpen(true);
      });
    } else {
      updateDropdownPosition();
    }
  };

  const handleInputClick = () => {
    requestAnimationFrame(() => {
      updateDropdownPosition();
      setIsDropdownOpen(true);
    });
  };

  const handleSelect = (product: ProductOption) => {
    onSelect(product);
    setSearchTerm("");
    setIsDropdownOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Input
          ref={inputRef}
          value={searchTerm}
          onChange={handleInputChange}
          onClick={handleInputClick}
          placeholder="Buscar produto por nome..."
          className="pr-8 text-xs h-9"
          autoComplete="off"
        />
        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>

      {isDropdownOpen && dropdownPosition && createPortal(
        <div
          data-product-dropdown
          className="fixed z-[99999] bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-auto scrollbar-minimal pointer-events-auto"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
          }}
          onWheel={(e) => e.stopPropagation()}
        >
          {filteredProducts.length > 0 ? (
            filteredProducts.map((product) => (
              <div
                key={product.id}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleSelect(product);
                }}
                className="px-3 py-2 cursor-pointer text-xs border-b border-border last:border-b-0 hover:bg-foreground/[0.05] bg-popover"
              >
                <div className="flex items-center">
                  <Package className="h-3 w-3 mr-2 text-muted-foreground" />
                  <div className="flex-1">
                    <span className="font-medium">{product.nome}</span>
                    <div className="text-[11px] text-muted-foreground">{product.valor}</div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-muted-foreground bg-popover">
              Nenhum produto encontrado
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
