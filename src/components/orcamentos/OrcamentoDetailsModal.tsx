import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { User, Mail, Phone, Calendar, Clock, Tag, MapPin, Package, DollarSign, FileText } from 'lucide-react';
import { Orcamento } from '@/types/orcamentos';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { formatDateForDisplay } from '@/utils/dateUtils';

interface OrcamentoDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  orcamento: Orcamento | null;
}

export default function OrcamentoDetailsModal({ 
  isOpen, 
  onClose, 
  orcamento 
}: OrcamentoDetailsModalProps) {
  const { origens } = useOrcamentos();

  if (!orcamento) return null;

  const origem = origens.find(o => o.id === orcamento.origemCliente);
  const valorFinal = orcamento.valorFinal || orcamento.valorTotal;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'rascunho': return 'bg-gray-100 text-gray-800';
      case 'pendente': return 'bg-yellow-100 text-yellow-800';
      case 'enviado': return 'bg-blue-100 text-blue-800';
      case 'follow-up': return 'bg-orange-100 text-orange-800';
      case 'fechado': return 'bg-green-100 text-green-800';
      case 'cancelado': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'rascunho': return 'Rascunho';
      case 'pendente': return 'Pendente';
      case 'enviado': return 'Enviado';
      case 'follow-up': return 'Follow-up';
      case 'fechado': return 'Fechado';
      case 'cancelado': return 'Cancelado';
      default: return status;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Detalhes do Orçamento
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Informações do Cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4" />
                Dados do Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{orcamento.cliente.nome}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{orcamento.cliente.email}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{orcamento.cliente.telefone}</span>
              </div>
            </CardContent>
          </Card>

          {/* Informações do Orçamento */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Informações Gerais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {formatDateForDisplay(orcamento.data)}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{orcamento.hora}</span>
              </div>

              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline">{orcamento.categoria}</Badge>
              </div>

              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {origem && (
                  <Badge 
                    style={{
                      backgroundColor: origem.cor + '20',
                      color: origem.cor,
                      border: `1px solid ${origem.cor}40`
                    }}
                  >
                    {origem.nome}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <Badge className={getStatusColor(orcamento.status)}>
                  {getStatusLabel(orcamento.status)}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Descrição do Serviço */}
        {orcamento.descricao && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Descrição do Serviço</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {orcamento.descricao}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Detalhes do Projeto */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Detalhes do Projeto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {orcamento.detalhes || 'Nenhum detalhe informado'}
            </p>
          </CardContent>
        </Card>

        {/* Pacotes e Produtos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4" />
              Pacotes e Produtos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Pacote Principal */}
              {orcamento.pacotePrincipal && (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">{orcamento.pacotePrincipal.nome}</p>
                      <p className="text-xs text-primary/70">Pacote Principal</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        R$ {orcamento.pacotePrincipal.valorCongelado.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Produtos inclusos no pacote */}
                  {orcamento.pacotePrincipal.produtosIncluidos.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-primary/10">
                      <p className="text-xs font-medium text-primary/70 mb-2">Produtos inclusos:</p>
                      {orcamento.pacotePrincipal.produtosIncluidos.map((produto, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs text-muted-foreground">
                          <span>{produto.nome} (x{produto.quantidade})</span>
                          <span>R$ {produto.valorUnitarioCongelado.toFixed(2)} (Incluso)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Produtos Adicionais */}
              {orcamento.produtosAdicionais && orcamento.produtosAdicionais.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Produtos adicionais:</p>
                  {orcamento.produtosAdicionais.map((produto, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{produto.nome}</p>
                        <p className="text-xs text-muted-foreground">Quantidade: {produto.quantidade}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          R$ {(produto.valorUnitarioCongelado * produto.quantidade).toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          R$ {produto.valorUnitarioCongelado.toFixed(2)} cada
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Fallback para compatibilidade com dados antigos */}
              {!orcamento.pacotePrincipal && !orcamento.produtosAdicionais && orcamento.pacotes && (
                <div className="space-y-2">
                  {orcamento.pacotes.map((pacote, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{pacote.nome}</p>
                        <p className="text-xs text-muted-foreground">Quantidade: {pacote.quantidade}</p>
                        {index === 0 && <p className="text-xs text-primary/70">Pacote Principal</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          R$ {(pacote.preco * pacote.quantidade).toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          R$ {pacote.preco.toFixed(2)} cada
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Resumo Financeiro */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Resumo Financeiro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Nova estrutura de cálculo */}
              {orcamento.pacotePrincipal && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Pacote principal:</span>
                  <span className="text-sm">R$ {orcamento.pacotePrincipal.valorCongelado.toFixed(2)}</span>
                </div>
              )}
              
              {orcamento.produtosAdicionais && orcamento.produtosAdicionais.length > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Produtos adicionais:</span>
                  <span className="text-sm">
                    R$ {orcamento.produtosAdicionais.reduce((total, p) => 
                      total + (p.valorUnitarioCongelado * p.quantidade), 0
                    ).toFixed(2)}
                  </span>
                </div>
              )}
              
              {/* Fallback para compatibilidade */}
              {!orcamento.pacotePrincipal && orcamento.valorTotal && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Subtotal:</span>
                  <span className="text-sm">R$ {orcamento.valorTotal.toFixed(2)}</span>
                </div>
              )}
              
              {orcamento.desconto > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Desconto:</span>
                  <span className="text-sm text-red-600">-R$ {orcamento.desconto.toFixed(2)}</span>
                </div>
              )}
              
              <Separator />
              
              <div className="flex justify-between items-center font-medium">
                <span className="text-sm">Total:</span>
                <span className="text-lg">
                  R$ {(orcamento.valorFinal || orcamento.valorTotal || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Informações de Criação */}
        <div className="text-xs text-muted-foreground text-center pt-4">
          Criado em: {new Date(orcamento.criadoEm + 'T00:00:00Z').toLocaleString('pt-BR')}
        </div>
      </DialogContent>
    </Dialog>
  );
}