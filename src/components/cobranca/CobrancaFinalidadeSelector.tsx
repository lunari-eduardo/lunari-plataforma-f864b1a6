import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
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
import { Check, ChevronsUpDown, Images } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface GalleryOption {
  id: string;
  titulo: string;
  data_sessao: string | null;
  valor_foto_extra: number | null;
  total_fotos_extras_vendidas: number | null;
  receita_fotos_extras: number | null;
}

export type CobrancaFinalidadeUI = 'sessao' | 'fotos_extras';

interface Props {
  /** ID do cliente (obrigatório) para filtrar as galerias listadas. */
  clienteId: string;
  /** Sessão atual, se houver — usada para pré-selecionar uma galeria vinculada. */
  sessionId?: string;

  finalidade: CobrancaFinalidadeUI;
  onFinalidadeChange: (v: CobrancaFinalidadeUI) => void;

  galeriaId: string | null;
  onGaleriaChange: (id: string | null, gallery: GalleryOption | null) => void;

  qtdFotos: number;
  onQtdFotosChange: (n: number) => void;
}

/**
 * Bloco unificado de "Finalidade da cobrança".
 *
 * - Mantém duas opções: Sessão (default) e Fotos extras da galeria.
 * - Quando "Fotos extras": busca galerias do cliente, expõe combobox + input
 *   de quantidade e mostra o valor sugerido (`qtd × valor_foto_extra`).
 * - Validação dura é feita no submit do modal pai (esse componente só guia
 *   o usuário visualmente).
 */
export function CobrancaFinalidadeSelector({
  clienteId,
  sessionId,
  finalidade,
  onFinalidadeChange,
  galeriaId,
  onGaleriaChange,
  qtdFotos,
  onQtdFotosChange,
}: Props) {
  const [galerias, setGalerias] = useState<GalleryOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (finalidade !== 'fotos_extras' || !clienteId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from('galerias')
        .select(
          'id, titulo, data_sessao, valor_foto_extra, total_fotos_extras_vendidas, receita_fotos_extras, session_id, cliente_id',
        )
        .eq('cliente_id', clienteId)
        .order('data_sessao', { ascending: false, nullsFirst: false });
      if (cancelled) return;
      const list: GalleryOption[] = (data || []).map((g: any) => ({
        id: g.id,
        titulo: g.titulo || 'Galeria sem título',
        data_sessao: g.data_sessao,
        valor_foto_extra: g.valor_foto_extra,
        total_fotos_extras_vendidas: g.total_fotos_extras_vendidas,
        receita_fotos_extras: g.receita_fotos_extras,
      }));
      setGalerias(list);
      // Pré-seleciona galeria da sessão atual, se houver
      if (!galeriaId && sessionId) {
        const match = (data || []).find(
          (g: any) => g.session_id === sessionId,
        );
        if (match) onGaleriaChange(match.id, list.find((x) => x.id === match.id) || null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalidade, clienteId, sessionId]);

  const selectedGallery = useMemo(
    () => galerias.find((g) => g.id === galeriaId) || null,
    [galerias, galeriaId],
  );

  const valorSugerido = useMemo(() => {
    if (!selectedGallery || !qtdFotos) return null;
    const unit = Number(selectedGallery.valor_foto_extra || 0);
    if (!unit) return null;
    return Math.round(unit * qtdFotos * 100) / 100;
  }, [selectedGallery, qtdFotos]);

  return (
    <div className="space-y-3">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        Finalidade da cobrança
      </Label>

      <RadioGroup
        value={finalidade}
        onValueChange={(v) => onFinalidadeChange(v as CobrancaFinalidadeUI)}
        className="grid grid-cols-2 gap-2"
      >
        <label
          className={cn(
            'flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer text-sm transition',
            finalidade === 'sessao'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:bg-muted/40',
          )}
        >
          <RadioGroupItem value="sessao" id="fin-sessao" />
          <span>Pagamento da sessão</span>
        </label>
        <label
          className={cn(
            'flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer text-sm transition',
            finalidade === 'fotos_extras'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:bg-muted/40',
          )}
        >
          <RadioGroupItem value="fotos_extras" id="fin-extras" />
          <span className="flex items-center gap-1.5">
            <Images className="h-3.5 w-3.5" />
            Fotos extras
          </span>
        </label>
      </RadioGroup>

      {finalidade === 'fotos_extras' && (
        <div className="space-y-3 rounded-md border bg-muted/20 p-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Galeria vinculada *</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal h-9"
                  disabled={loading}
                >
                  {selectedGallery ? (
                    <span className="truncate">
                      {selectedGallery.titulo}
                      {selectedGallery.data_sessao
                        ? ` · ${new Date(selectedGallery.data_sessao).toLocaleDateString('pt-BR')}`
                        : ''}
                    </span>
                  ) : loading ? (
                    'Carregando galerias…'
                  ) : (
                    'Selecione uma galeria'
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[--radix-popover-trigger-width] z-[70]">
                <Command>
                  <CommandInput placeholder="Buscar galeria…" autoComplete="off" />
                  <CommandList>
                    <CommandEmpty>
                      {galerias.length === 0
                        ? 'Este cliente não tem galerias.'
                        : 'Nenhuma galeria encontrada.'}
                    </CommandEmpty>
                    <CommandGroup>
                      {galerias.map((g) => (
                        <CommandItem
                          key={g.id}
                          value={`${g.titulo} ${g.data_sessao || ''}`}
                          onSelect={() => {
                            onGaleriaChange(g.id, g);
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              g.id === galeriaId ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                          <div className="flex flex-col">
                            <span className="text-sm">{g.titulo}</span>
                            <span className="text-xs text-muted-foreground">
                              {g.data_sessao
                                ? new Date(g.data_sessao).toLocaleDateString('pt-BR')
                                : 'Sem data'}
                              {g.valor_foto_extra
                                ? ` · ${Number(g.valor_foto_extra).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/foto`
                                : ''}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Qtd. de fotos *</Label>
              <Input
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={qtdFotos || ''}
                onChange={(e) =>
                  onQtdFotosChange(
                    e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0),
                  )
                }
                onFocus={(e) => {
                  if (qtdFotos === 0) e.target.value = '';
                }}
                placeholder="0"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor sugerido</Label>
              <div className="h-9 px-3 rounded-md border bg-background flex items-center text-sm">
                {valorSugerido != null
                  ? valorSugerido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                  : '—'}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Esta cobrança será refletida automaticamente na galeria (fotos pagas,
            receita de extras e finalização da seleção).
          </p>
        </div>
      )}
    </div>
  );
}
