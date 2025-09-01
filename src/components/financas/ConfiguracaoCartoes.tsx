import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus, CreditCard } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
interface ConfiguracaoCartoesProps {
  // Props removidas - agora usa AppContext diretamente
}
export default function ConfiguracaoCartoes({}: ConfiguracaoCartoesProps) {
  const {
    cartoes,
    adicionarCartao,
    removerCartao
  } = useAppContext();
  const [novoCartao, setNovoCartao] = useState({
    nome: '',
    diaVencimento: '',
    diaFechamento: ''
  });
  const adicionarNovoCartao = () => {
    if (!novoCartao.nome || !novoCartao.diaVencimento || !novoCartao.diaFechamento) return;
    const diaVencimento = parseInt(novoCartao.diaVencimento);
    const diaFechamento = parseInt(novoCartao.diaFechamento);
    if (diaVencimento < 1 || diaVencimento > 31 || diaFechamento < 1 || diaFechamento > 31) {
      alert('Dias devem estar entre 1 e 31');
      return;
    }
    try {
      adicionarCartao({
        nome: novoCartao.nome,
        diaVencimento,
        diaFechamento
      });
      setNovoCartao({
        nome: '',
        diaVencimento: '',
        diaFechamento: ''
      });
    } catch (error) {
      console.error('Erro ao adicionar cartão:', error);
      alert('Erro ao adicionar cartão');
    }
  };
  const removerCartaoLocal = (id: string) => {
    try {
      removerCartao(id);
    } catch (error) {
      console.error('Erro ao remover cartão:', error);
      alert('Erro ao remover cartão');
    }
  };
  return <div className="space-y-6">
      <div className="flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-lunar-success " />
        <h2 className="font-semibold text-lunar-text text-base">Cartões de Crédito</h2>
      </div>

      {/* Formulário para adicionar novo cartão */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Adicionar Novo Cartão</CardTitle>
          <CardDescription>
            Configure os dados do cartão para cálculo automático de vencimentos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="nomeCartao">Nome do Cartão</Label>
              <Input id="nomeCartao" placeholder="Ex: Nubank, Itaú, etc." value={novoCartao.nome} onChange={e => setNovoCartao({
              ...novoCartao,
              nome: e.target.value
             })} className="bg-card" />
            </div>
            <div>
              <Label htmlFor="diaVencimento">Dia de Vencimento</Label>
              <Input id="diaVencimento" type="number" min="1" max="31" placeholder="Ex: 15" value={novoCartao.diaVencimento} onChange={e => setNovoCartao({
              ...novoCartao,
              diaVencimento: e.target.value
             })} className="bg-card" />
              <p className="text-xs text-lunar-textSecondary mt-1">
                Dia do mês que a fatura vence
              </p>
            </div>
            <div>
              <Label htmlFor="diaFechamento">Dia de Fechamento</Label>
              <Input id="diaFechamento" type="number" min="1" max="31" placeholder="Ex: 10" value={novoCartao.diaFechamento} onChange={e => setNovoCartao({
              ...novoCartao,
              diaFechamento: e.target.value
            })} className="bg-card" />
              <p className="text-xs text-lunar-textSecondary mt-1">
                Dia do mês que a fatura fecha
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={adicionarNovoCartao} disabled={!novoCartao.nome || !novoCartao.diaVencimento || !novoCartao.diaFechamento} className="bg-lunar-accent">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Cartão
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de cartões existentes */}
      <div className="space-y-4">
        <h3 className="font-medium text-lunar-text text-base">Cartões Configurados</h3>
        
        {cartoes.length === 0 ? <Card>
            <CardContent className="py-8 text-center">
              <CreditCard className="h-12 w-12 mx-auto text-lunar-textSecondary mb-4" />
              <h3 className="text-lg font-medium text-lunar-text mb-2">Nenhum cartão configurado</h3>
              <p className="text-lunar-textSecondary">Adicione um cartão para começar a usar lançamentos via cartão de crédito.</p>
            </CardContent>
          </Card> : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cartoes.map(cartao => <Card key={cartao.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-lunar-success" />
                      <CardTitle className="text-lg">{cartao.nome}</CardTitle>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removerCartaoLocal(cartao.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-lunar-textSecondary">Fechamento:</span>
                      <span className="text-sm font-medium">Dia {cartao.diaFechamento}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-lunar-textSecondary">Vencimento:</span>
                      <span className="text-sm font-medium">Dia {cartao.diaVencimento}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-lunar-textSecondary">Status:</span>
                      <span className={`text-sm font-medium ${cartao.ativo ? 'text-lunar-success' : 'text-lunar-error'}`}>
                        {cartao.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>)}
          </div>}
      </div>

      {/* Informações sobre o funcionamento */}
      <Card className="bg-muted border-border">
        <CardHeader>
          <CardTitle className="text-lg text-lunar-text">Como funciona?</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-lunar-text">
            <li>• <strong>Dia de Fechamento:</strong> Compras após este dia entram na fatura do mês seguinte</li>
            <li>• <strong>Dia de Vencimento:</strong> Data em que a fatura deve ser paga</li>
            <li>• <strong>Parcelamento:</strong> Cada parcela será lançada no vencimento da fatura correspondente</li>
            <li>• <strong>Cálculo Automático:</strong> O sistema calcula automaticamente em que fatura cada compra cairá</li>
          </ul>
        </CardContent>
      </Card>
    </div>;
}