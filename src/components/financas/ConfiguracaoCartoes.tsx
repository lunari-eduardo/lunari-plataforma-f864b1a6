import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, CreditCard, Loader2, Info } from 'lucide-react';
import { useCreditCardsSupabase } from '@/hooks/useCreditCardsSupabase';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function ConfiguracaoCartoes() {
  const {
    cartoes,
    adicionarCartao,
    removerCartao,
    isCreating,
    isDeleting
  } = useCreditCardsSupabase();
  
  const [novoCartao, setNovoCartao] = useState({
    nome: '',
    diaVencimento: '',
    diaFechamento: ''
  });

  const adicionarNovoCartao = () => {
    if (!novoCartao.nome || !novoCartao.diaVencimento || !novoCartao.diaFechamento) return;
    if (isCreating) return;
    
    const diaVencimento = parseInt(novoCartao.diaVencimento);
    const diaFechamento = parseInt(novoCartao.diaFechamento);
    if (diaVencimento < 1 || diaVencimento > 31 || diaFechamento < 1 || diaFechamento > 31) {
      alert('Dias devem estar entre 1 e 31');
      return;
    }
    
    const jaExiste = cartoes.some(c => c.nome.toLowerCase() === novoCartao.nome.toLowerCase());
    if (jaExiste) {
      alert(`Cartão "${novoCartao.nome}" já existe!`);
      return;
    }
    
    try {
      adicionarCartao({ nome: novoCartao.nome, diaVencimento, diaFechamento });
      setNovoCartao({ nome: '', diaVencimento: '', diaFechamento: '' });
    } catch (error) {
      console.error('Erro ao adicionar cartão:', error);
      alert('Erro ao adicionar cartão');
    }
  };

  const removerCartaoLocal = (id: string) => {
    if (isDeleting) return;
    try {
      removerCartao(id);
    } catch (error) {
      console.error('Erro ao remover cartão:', error);
      alert('Erro ao remover cartão');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-lunar-success" />
        <h2 className="font-semibold text-foreground text-base">Cartões de Crédito</h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs">
              <p className="font-medium mb-1">Como funciona?</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• <strong>Fechamento:</strong> Compras após este dia entram na fatura do mês seguinte</li>
                <li>• <strong>Vencimento:</strong> Data em que a fatura deve ser paga</li>
                <li>• O sistema calcula automaticamente em que fatura cada compra cairá</li>
              </ul>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Formulário inline */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 p-3 bg-muted/30 border border-border/50 rounded-lg">
        <div className="flex-1 space-y-1">
          <Label htmlFor="nomeCartao" className="text-xs text-muted-foreground">Nome</Label>
          <Input
            id="nomeCartao"
            placeholder="Ex: Nubank, Itaú..."
            value={novoCartao.nome}
            onChange={e => setNovoCartao({ ...novoCartao, nome: e.target.value })}
            className="h-9 text-sm bg-background border-border/50"
          />
        </div>
        <div className="w-full sm:w-28 space-y-1">
          <Label htmlFor="diaFechamento" className="text-xs text-muted-foreground">Fechamento</Label>
          <Input
            id="diaFechamento"
            type="number"
            min="1"
            max="31"
            placeholder="Dia"
            value={novoCartao.diaFechamento}
            onChange={e => setNovoCartao({ ...novoCartao, diaFechamento: e.target.value })}
            className="h-9 text-sm bg-background border-border/50"
          />
        </div>
        <div className="w-full sm:w-28 space-y-1">
          <Label htmlFor="diaVencimento" className="text-xs text-muted-foreground">Vencimento</Label>
          <Input
            id="diaVencimento"
            type="number"
            min="1"
            max="31"
            placeholder="Dia"
            value={novoCartao.diaVencimento}
            onChange={e => setNovoCartao({ ...novoCartao, diaVencimento: e.target.value })}
            className="h-9 text-sm bg-background border-border/50"
          />
        </div>
        <Button
          onClick={adicionarNovoCartao}
          disabled={!novoCartao.nome || !novoCartao.diaVencimento || !novoCartao.diaFechamento || isCreating}
          size="sm"
          className="h-9 px-4 shrink-0"
        >
          {isCreating ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-1.5" />
          )}
          {isCreating ? 'Adicionando...' : 'Adicionar'}
        </Button>
      </div>

      {/* Lista de cartões */}
      {cartoes.length === 0 ? (
        <div className="py-8 text-center">
          <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum cartão configurado ainda.</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Adicione um cartão acima para começar.</p>
        </div>
      ) : (
        <div className="divide-y divide-border/20">
          {cartoes.map(cartao => (
            <div
              key={cartao.id}
              className="group flex items-center gap-3 py-2.5 px-2 hover:bg-muted/30 transition-colors rounded-sm"
            >
              <CreditCard className="h-4 w-4 text-lunar-success shrink-0" />
              <span className="text-sm font-medium text-foreground flex-1 min-w-0 truncate">
                {cartao.nome}
              </span>
              <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                <span>Fech. dia {cartao.diaFechamento}</span>
                <span>Venc. dia {cartao.diaVencimento}</span>
                <span className={cartao.ativo ? 'text-lunar-success' : 'text-destructive'}>
                  {cartao.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removerCartaoLocal(cartao.id)}
                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
