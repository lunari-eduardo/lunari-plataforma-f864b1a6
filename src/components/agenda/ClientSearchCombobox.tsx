
import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Check, ChevronDown, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClientesRealtime } from '@/hooks/useClientesRealtime';

// Função para normalizar texto (remover acentos e caracteres especiais)
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos
    .replace(/[^a-z0-9\s]/g, ''); // Remove caracteres especiais
};

interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
}

interface ClientSearchComboboxProps {
  value?: string;
  onSelect: (clientId: string) => void;
  placeholder?: string;
}

// Integrado com hook real de clientes do Supabase

export default function ClientSearchCombobox({
  value,
  onSelect,
  placeholder = "Buscar cliente..."
}: ClientSearchComboboxProps) {
  const { clientes, isLoading } = useClientesRealtime();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Convert clientes from Supabase to Client format
  const clientsFromSupabase: Client[] = clientes.map(cliente => ({
    id: cliente.id,
    name: cliente.nome,
    phone: cliente.telefone,
    email: cliente.email || ''
  }));

  const selectedClient = clientsFromSupabase.find(client => client.id === value);

  // Filter clients based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredClients(clientsFromSupabase);
    } else {
      const normalizedSearch = normalizeText(searchTerm);
      const filtered = clientsFromSupabase.filter(client => {
        const normalizedName = normalizeText(client.name);
        const normalizedEmail = normalizeText(client.email);
        const normalizedPhone = (client.phone || '').replace(/[^0-9]/g, '');
        const numericSearch = searchTerm.replace(/[^0-9]/g, '');
        const matchesPhone = numericSearch.length > 0 && normalizedPhone.includes(numericSearch);
        
        return normalizedName.includes(normalizedSearch) ||
               normalizedEmail.includes(normalizedSearch) ||
               matchesPhone;
      });
      setFilteredClients(filtered);
    }
  }, [searchTerm, clientsFromSupabase.length]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (clientId: string) => {
    onSelect(clientId);
    setIsOpen(false);
    setSearchTerm('');
    setIsEditing(false);
    inputRef.current?.blur();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsEditing(true);
    setIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    setIsEditing(true);
  };

  const handleClear = () => {
    onSelect('');
    setSearchTerm('');
    setIsEditing(false);
    setIsOpen(false);
  };

  const displayValue = (isEditing || !selectedClient) ? searchTerm : selectedClient.name;

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Input
          ref={inputRef}
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={isLoading ? "Carregando clientes..." : placeholder}
          className="pr-16 text-xs"
          disabled={isLoading}
        />
        {selectedClient && !isEditing && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-8 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        )}
        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>

      {isOpen && (
        <div className="absolute z-[9999] w-full mt-1 dropdown-solid border border-border rounded-md shadow-lg max-h-60 overflow-auto scrollbar-minimal">
          {filteredClients.length > 0 ? (
            filteredClients.map((client) => (
              <div
                key={client.id}
                onClick={() => handleSelect(client.id)}
                className="px-3 py-2 dropdown-solid-item cursor-pointer text-xs border-b border-border last:border-b-0"
              >
                <div className="flex items-center">
                  <User className="h-3 w-3 mr-2 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="flex items-center">
                      <span className="font-medium text-popover-foreground">{client.name}</span>
                      {value === client.id && (
                        <Check className="ml-2 h-3 w-3 text-green-600" />
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {client.phone} • {client.email}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Nenhum cliente encontrado
            </div>
          )}
        </div>
      )}
    </div>
  );
}
