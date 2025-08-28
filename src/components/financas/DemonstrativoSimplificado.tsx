import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, TrendingUp, TrendingDown, DollarSign, Percent, User, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@/utils/financialUtils';
import { DemonstrativoSimplificado as DemonstrativoType } from '@/types/extrato';
import { useUserProfile, useUserBranding } from '@/hooks/useUserProfile';
import { generateFinancialPDF, FinancialExportData } from '@/utils/financialPdfUtils';
import { TransacaoComItem } from '@/types/financas';
interface DemonstrativoSimplificadoProps {
  demonstrativo: DemonstrativoType;
  periodo: {
    inicio: string;
    fim: string;
  };
  transactions?: TransacaoComItem[];
}
export default function DemonstrativoSimplificado({
  demonstrativo,
  periodo,
  transactions = []
}: DemonstrativoSimplificadoProps) {
  const { getProfileOrDefault } = useUserProfile();
  const { getBrandingOrDefault } = useUserBranding();
  const navigate = useNavigate();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const {
    receitas,
    despesas,
    resumoFinal
  } = demonstrativo;

  const validateProfileData = () => {
    const profile = getProfileOrDefault();
    return !!(profile.nomeEmpresa || profile.nomeCompleto);
  };

  const handleExportarPDF = async () => {
    if (!validateProfileData()) {
      setShowProfileModal(true);
      return;
    }

    setIsGenerating(true);
    try {
      const profile = getProfileOrDefault();
      const branding = getBrandingOrDefault();
      
      const startDate = new Date(periodo.inicio);
      const month = startDate.getMonth() + 1;
      const year = startDate.getFullYear();

      // Converter dados do demonstrativo para transações detalhadas
      const transacoesDetalhadas: TransacaoComItem[] = [
        // Receitas - sessões
        ...(receitas.sessoes > 0 ? [{
          id: 'receita-sessoes',
          item_id: 'receita-sessoes',
          valor: receitas.sessoes,
          data_vencimento: periodo.inicio,
          status: 'Pago' as const,
          parcelaInfo: null,
          parcelas: null,
          observacoes: 'Receita com sessões do período',
          userId: 'current-user',
          criadoEm: new Date().toISOString(),
          item: {
            id: 'receita-sessoes',
            nome: 'Receita com Sessões',
            grupo_principal: 'Receita Não Operacional',
            userId: 'current-user',
            ativo: true,
            criadoEm: new Date().toISOString(),
          }
        }] : []),
        
        // Receitas - produtos
        ...(receitas.produtos > 0 ? [{
          id: 'receita-produtos',
          item_id: 'receita-produtos',
          valor: receitas.produtos,
          data_vencimento: periodo.inicio,
          status: 'Pago' as const,
          parcelaInfo: null,
          parcelas: null,
          observacoes: 'Receita com produtos do período',
          userId: 'current-user',
          criadoEm: new Date().toISOString(),
          item: {
            id: 'receita-produtos',
            nome: 'Receita com Produtos',
            grupo_principal: 'Receita Não Operacional',
            userId: 'current-user',
            ativo: true,
            criadoEm: new Date().toISOString(),
          }
        }] : []),
        
        // Receitas não operacionais
        ...(receitas.naoOperacionais > 0 ? [{
          id: 'receita-nao-operacional',
          item_id: 'receita-nao-operacional',
          valor: receitas.naoOperacionais,
          data_vencimento: periodo.inicio,
          status: 'Pago' as const,
          parcelaInfo: null,
          parcelas: null,
          observacoes: 'Receitas não operacionais do período',
          userId: 'current-user',
          criadoEm: new Date().toISOString(),
          item: {
            id: 'receita-nao-operacional',
            nome: 'Receitas Não Operacionais',
            grupo_principal: 'Receita Não Operacional',
            userId: 'current-user',
            ativo: true,
            criadoEm: new Date().toISOString(),
          }
        }] : []),
        
        // Despesas por categoria
        ...despesas.categorias.flatMap(categoria =>
          categoria.itens.map(item => ({
            id: `despesa-${categoria.grupo}-${item.nome}`,
            item_id: `despesa-${categoria.grupo}-${item.nome}`,
            valor: item.valor,
            data_vencimento: periodo.inicio,
            status: 'Pago' as const,
            parcelaInfo: null,
            parcelas: null,
            observacoes: `${categoria.grupo} - ${item.nome}`,
            userId: 'current-user',
            criadoEm: new Date().toISOString(),
            item: {
              id: `despesa-${categoria.grupo}-${item.nome}`,
              nome: item.nome,
              grupo_principal: categoria.grupo as any,
              userId: 'current-user',
              ativo: true,
              criadoEm: new Date().toISOString(),
            }
          }))
        )
      ];

      const exportData: FinancialExportData = {
        profile,
        branding,
        transactions: transacoesDetalhadas,
        period: { month, year, isAnnual: false },
        summary: {
          totalReceitas: receitas.totalReceitas,
          totalDespesas: despesas.totalDespesas,
          saldoFinal: resumoFinal.resultadoLiquido,
          transacoesPagas: transacoesDetalhadas.length,
          transacoesFaturadas: 0,
          transacoesAgendadas: 0
        }
      };

      await generateFinancialPDF(exportData, {
        type: 'monthly',
        period: { month, year },
        includeDetails: true,
        includeGraphics: false
      });

      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar o PDF. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGoToProfile = () => {
    setShowProfileModal(false);
    navigate('/minha-conta');
  };
  const renderSecaoReceitas = () => <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <TrendingUp className="h-5 w-5 mr-2 text-green-600" />
          Receitas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Receita com sessões</span>
          <span className="font-medium text-green-600">
            {formatCurrency(receitas.sessoes)}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Receita com produtos</span>
          <span className="font-medium text-green-600">
            {formatCurrency(receitas.produtos)}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Receitas não operacionais</span>
          <span className="font-medium text-green-600">
            {formatCurrency(receitas.naoOperacionais)}
          </span>
        </div>
        
        <Separator />
        
        <div className="flex justify-between items-center">
          <span className="font-semibold">Total de Receitas</span>
          <span className="font-bold text-lg text-green-600">
            {formatCurrency(receitas.totalReceitas)}
          </span>
        </div>
      </CardContent>
    </Card>;
  const renderSecaoDespesas = () => <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <TrendingDown className="h-5 w-5 mr-2 text-red-600" />
          Despesas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {despesas.categorias.map((categoria, index) => <div key={index} className="space-y-2">
            <div className="font-medium text-sm text-muted-foreground border-b pb-1">
              {categoria.grupo}
            </div>
            
            {categoria.itens.map((item, itemIndex) => <div key={itemIndex} className="flex justify-between items-center pl-4">
                <span className="text-xs text-muted-foreground">{item.nome}</span>
                <span className="text-sm font-medium text-red-600">
                  {formatCurrency(item.valor)}
                </span>
              </div>)}
            
            <div className="flex justify-between items-center pl-4 border-t pt-1">
              <span className="text-sm font-medium">Total {categoria.grupo}</span>
              <span className="font-semibold text-red-600">
                {formatCurrency(categoria.total)}
              </span>
            </div>
            
            {index < despesas.categorias.length - 1 && <Separator className="mt-3" />}
          </div>)}
        
        <Separator />
        
        <div className="flex justify-between items-center">
          <span className="font-semibold">Total de Despesas</span>
          <span className="font-bold text-lg text-red-600">
            {formatCurrency(despesas.totalDespesas)}
          </span>
        </div>
      </CardContent>
    </Card>;
  const renderResumoFinal = () => <Card className="bg-gradient-to-r from-background to-muted/30">
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <DollarSign className="h-5 w-5 mr-2" />
          Resumo Final
        </CardTitle>
        <CardDescription>
          Período: {new Date(periodo.inicio).toLocaleDateString('pt-BR')} a{' '}
          {new Date(periodo.fim).toLocaleDateString('pt-BR')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Receita total</span>
              <span className="font-medium text-green-600">
                {formatCurrency(resumoFinal.receitaTotal)}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm">(-) Total de despesas</span>
              <span className="font-medium text-red-600">
                {formatCurrency(resumoFinal.despesaTotal)}
              </span>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm flex items-center">
                <Percent className="h-3 w-3 mr-1" />
                Margem líquida
              </span>
              <span className={`font-medium ${resumoFinal.margemLiquida >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {resumoFinal.margemLiquida.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
        
        <Separator />
        
        <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
          <span className="font-bold text-lg">= Resultado líquido do período</span>
          <span className={`font-bold text-2xl ${resumoFinal.resultadoLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(resumoFinal.resultadoLiquido)}
          </span>
        </div>
      </CardContent>
    </Card>;
  return <div className="space-y-6">
      {/* Header com botão de exportação */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-xl">Demonstrativo Financeiro</h2>
          <p className="text-muted-foreground">
            Resumo categorizado para análise contábil
          </p>
        </div>
        
        <Button 
          onClick={handleExportarPDF} 
          disabled={isGenerating}
          className="flex items-center space-x-2"
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Gerando...</span>
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              <span>Exportar PDF</span>
            </>
          )}
        </Button>
      </div>

      {/* Grid de seções */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderSecaoReceitas()}
        {renderSecaoDespesas()}
      </div>

      {/* Resumo final */}
      {renderResumoFinal()}

      {/* Modal de redirecionamento para perfil */}
      <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Dados da Empresa Necessários
            </DialogTitle>
            <DialogDescription>
              Para gerar o PDF é necessário preencher as informações da empresa no seu perfil.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-medium text-sm mb-2">Dados obrigatórios:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Nome da empresa ou nome completo</li>
                <li>• CNPJ ou CPF (opcional mas recomendado)</li>
                <li>• Endereço comercial (opcional)</li>
              </ul>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowProfileModal(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleGoToProfile}
                className="flex-1 gap-2"
              >
                <User className="w-4 h-4" />
                Ir para Minha Conta
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>;
}