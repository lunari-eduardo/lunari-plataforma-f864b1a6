/**
 * SmartSelect — combobox pesquisável para grupos, categorias, favorecidos, formas de pagamento.
 * Herda o padrão Searchable Combobox da constituição (autocomplete off, busca normalizada,
 * criação inline opcional).
 */
import { memo, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

export interface SmartSelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SmartSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  options: SmartSelectOption[];
  placeholder?: string;
  emptyMessage?: string;
  onCreateNew?: (query: string) => void;
  createNewLabel?: string;
  disabled?: boolean;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export const SmartSelect = memo(function SmartSelect({
  value,
  onChange,
  options,
  placeholder = 'Selecionar…',
  emptyMessage = 'Nenhum resultado.',
  onCreateNew,
  createNewLabel = 'Criar',
  disabled,
}: SmartSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = normalize(query);
    return options.filter(
      (o) => normalize(o.label).includes(q) || normalize(o.description ?? '').includes(q),
    );
  }, [options, query]);

  const canCreate =
    onCreateNew && query.trim().length > 0 && !filtered.some((o) => normalize(o.label) === normalize(query));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors',
            'hover:bg-muted/40',
            selected ? 'text-foreground' : 'text-muted-foreground',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          <span className="truncate text-left">
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Buscar…"
            autoComplete="off"
          />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            {filtered.length > 0 && (
              <CommandGroup>
                {filtered.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.value}
                    onSelect={() => {
                      onChange(opt.value);
                      setOpen(false);
                      setQuery('');
                    }}
                    className="flex items-start gap-2"
                  >
                    <Check
                      className={cn(
                        'h-3.5 w-3.5 mt-0.5 shrink-0 text-accent-gold',
                        value === opt.value ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-foreground truncate">
                        {opt.label}
                      </div>
                      {opt.description && (
                        <div className="text-[11px] text-muted-foreground truncate">
                          {opt.description}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {canCreate && (
              <CommandGroup>
                <CommandItem
                  value={`__create__${query}`}
                  onSelect={() => {
                    onCreateNew?.(query.trim());
                    setOpen(false);
                    setQuery('');
                  }}
                  className="flex items-center gap-2 text-accent-gold"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="text-[13px] font-medium">
                    {createNewLabel} “{query.trim()}”
                  </span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});

export default SmartSelect;
