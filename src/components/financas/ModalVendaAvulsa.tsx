import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useVendaAvulsa } from '@/hooks/useVendaAvulsa';
import { ShoppingBag, Loader2 } from 'lucide-react';
import { formatDateForStorage } from '@/utils/dateUtils';

interface ModalVendaAvulsaProps {
  aberto: boolean;
  onFechar: () => void;
  onSucesso?: () => void;
}

interface ClienteOption {
  id: string;
  nome: string;
}

interface CategoriaOption {
  id: string;
  nome: string;
}

export default function ModalVendaAvulsa({ aberto, onFechar, onSucesso }: ModalVendaAvulsaProps) {
  const { criarVendaAvulsa, loading } = useVendaAvulsa();

  // Form state
  const [clienteId, setClienteId] = useState('');
  const [data, setData] = useState(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  });
  const [categoria, setCategoria] = useState('');
  const [pacote, setPacote] = useState('');
  const [valorTotal, setValorTotal] = useState('');
  const [desconto, setDesconto] = useState('');
  const [descricao, setDescricao] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [registrarPagamento, setRegistrarPagamento] = useState(true);

  // Data lists
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [categorias, setCategorias] = useState<CategoriaOption[]>([]);
  const [clienteSearch, setClienteSearch] = useState('');

  // Load data
  useEffect(() => {
    if (!aberto) return;

    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [clientesRes, categoriasRes] = await Promise.all([
        supabase.from('clientes').select('id, nome').eq('user_id', user.id).order('nome'),
        supabase.from('categorias').select('id, nome').eq('user_id', user.id).order('nome'),
      ]);

      if (clientesRes.data) setClientes(clientesRes.data);
      if (categoriasRes.data) setCategorias(categoriasRes.data);
    };

    loadData();
  }, [aberto]);

  const clientesFiltrados = useMemo(() => {
    if (!clienteSearch.trim()) return clientes;
    const search = clienteSearch.toLowerCase();
    return clientes.filter(c => c.nome.toLowerCase().includes(search));
  }, [clientes, clienteSearch]);

  const valorFinal = useMemo(() => {
    const total = parseFloat(valorTotal) || 0;
    const desc = parseFloat(desconto) || 0;
    return Math.max(0, total - desc);
  }, [valorTotal, desconto]);

  const resetForm = () => {
    setClienteId('');
    setCategoria('');
    setPacote('');
    setValorTotal('');
    setDesconto('');
    setDescricao('');
    setObservacoes('');
    setRegistrarPagamento(true);
    setClienteSearch('');
  };

  const handleSubmit = async () => {
    if (!clienteId || !categoria || !valorTotal) return;

    try {
      await criarVendaAvulsa({
        clienteId,
        data,
        categoria,
        pacote: pacote || undefined,
        valorTotal: valorFinal,
        desconto: parseFloat(desconto) || 0,
        descricao: descricao || undefined,
        observacoes: observacoes || undefined,
        registrarPagamento,
      });

      resetForm();
      onSucesso?.();
      onFechar();
    } catch {
      // Error handled in hook
    }
  };

  const isValid = clienteId && categoria && parseFloat(valorTotal) > 0;

  return (
    <Dialog open={aberto} onOpenChange={(open) => { if (!open) onFechar(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            Nova Venda Avulsa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Cliente */}
          <div className="space-y-1.5">
            <Label className="text-sm">Cliente *</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 pb-2">
                  <Input
                    placeholder="Buscar cliente..."
                    value={clienteSearch}
                    onChange={(e) => setClienteSearch(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                {clientesFiltrados.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
                {clientesFiltrados.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">Nenhum cliente encontrado</p>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Data + Categoria */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Data *</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Categoria *</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map(c => (
                    <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Pacote (optional text) */}
          <div className="space-y-1.5">
            <Label className="text-sm">Pacote / Produto (opcional)</Label>
            <Input
              placeholder="Ex: Álbum 30x30, Ensaio Express..."
              value={pacote}
              onChange={(e) => setPacote(e.target.value)}
            />
          </div>

          {/* Valor + Desconto */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Valor Total *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={valorTotal}
                onChange={(e) => setValorTotal(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Desconto</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={desconto}
                onChange={(e) => setDesconto(e.target.value)}
              />
            </div>
          </div>

          {/* Valor final */}
          {(parseFloat(desconto) || 0) > 0 && (
            <div className="text-sm text-muted-foreground px-1">
              Valor final: <span className="font-semibold text-foreground">R$ {valorFinal.toFixed(2)}</span>
            </div>
          )}

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label className="text-sm">Descrição</Label>
            <Textarea
              placeholder="Detalhes da venda..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Registrar pagamento */}
          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="registrar-pagamento"
              checked={registrarPagamento}
              onCheckedChange={(checked) => setRegistrarPagamento(!!checked)}
            />
            <Label htmlFor="registrar-pagamento" className="text-sm cursor-pointer">
              Registrar pagamento imediato
            </Label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onFechar} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!isValid || loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Registrar Venda'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
