
import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Check, ChevronDown, User } from 'lucide-react';
import { Cliente } from '@/types/orcamentos';

interface ClientSearchInputProps {
  clientes: Cliente[];
  selectedClient: Cliente | null;
  onSelectClient: (client: Cliente | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function ClientSearchInput({
  clientes,
  selectedClient,
  onSelectClient,
  placeholder = "Buscar cliente...",
  disabled = false
}: ClientSearchInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredClients, setFilteredClients] = useState<Cliente[]>(clientes);
  const [isTyping, setIsTyping] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sincronizar valor do input com o cliente selecionado
  useEffect(() => {
    if (selectedClient && !isTyping) {
      setSearchTerm('');
    }
  }, [selectedClient, isTyping]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = clientes.filter(client =>
        (client.nome?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        (client.email?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        (client.telefone?.includes(searchTerm) || false)
      );
      setFilteredClients(filtered);
    } else {
      setFilteredClients(clientes);
    }
  }, [searchTerm, clientes]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (client: Cliente) => {
    console.log('Cliente selecionado:', client.nome);
    onSelectClient(client);
    setIsOpen(false);
    setSearchTerm('');
    setIsTyping(false);
    inputRef.current?.blur();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setIsTyping(true);
    setIsOpen(true);
    
    if (value === '') {
      onSelectClient(null);
      setIsTyping(false);
    }
  };

  const handleInputFocus = () => {
    if (disabled) return;
    
    // Não abrir automaticamente quando em modal de edição
    // Deixar o usuário explicitamente clicar ou digitar para abrir
    if (!selectedClient && searchTerm) {
      setIsOpen(true);
      setIsTyping(true);
    }
  };

  const handleInputBlur = () => {
    // Delay para permitir que o clique na lista funcione
    setTimeout(() => {
      setIsTyping(false);
    }, 200);
  };

  const displayValue = selectedClient && !isTyping ? selectedClient.nome : searchTerm;

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Input
          ref={inputRef}
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          className="pr-8"
          disabled={disabled}
        />
        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredClients.length > 0 ? (
            filteredClients.map((client) => (
              <div
                key={client.id}
                onClick={() => handleSelect(client)}
                className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <div className="flex items-center">
                  <User className="h-4 w-4 mr-2 text-gray-400" />
                  <div className="flex-1">
                    <div className="flex items-center">
                      <span className="font-medium">{client.nome}</span>
                      {selectedClient?.id === client.id && (
                        <Check className="ml-2 h-4 w-4 text-green-600" />
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {client.telefone} • {client.email}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500">
              Nenhum cliente encontrado
            </div>
          )}
        </div>
      )}
    </div>
  );
}
