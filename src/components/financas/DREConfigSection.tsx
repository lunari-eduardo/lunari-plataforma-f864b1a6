import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calculator, Percent, CreditCard, Users, Building } from 'lucide-react';
import { DREConfig, DRE_CONFIG_FOTOGRAFOS } from '@/types/dre';
import { useToast } from '@/hooks/use-toast';

const DRE_CONFIG_KEY = 'dre_config_v1';

export default function DREConfigSection() {
  const { toast } = useToast();
  
  const [config, setConfig] = useState<DREConfig>(() => {
    const saved = localStorage.getItem(DRE_CONFIG_KEY);
    if (saved) {
      try {
        return { ...DRE_CONFIG_FOTOGRAFOS, ...JSON.parse(saved) } as DREConfig;
      } catch (error) {
        console.error('Erro ao carregar configuração DRE:', error);
      }
    }
    return DRE_CONFIG_FOTOGRAFOS as DREConfig;
  });

  const salvarConfig = () => {
    try {
      localStorage.setItem(DRE_CONFIG_KEY, JSON.stringify(config));
      toast({
        title: "Sucesso",
        description: "Configurações DRE salvas com sucesso!"
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const aplicarPadroesFotografos = () => {
    setConfig(DRE_CONFIG_FOTOGRAFOS as DREConfig);
    toast({
      title: "Padrões Aplicados",
      description: "Configurações padrão para fotógrafos aplicadas com sucesso!"
    });
  };

  const updateConfig = (key: keyof DREConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const updateGatewayFee = (meio: string, taxa: number) => {
    setConfig(prev => ({
      ...prev,
      gatewayFees: { ...prev.gatewayFees, [meio]: taxa }
    }));
  };

  const updateMapeamento = (termo: string, grupo: string) => {
    setConfig(prev => ({
      ...prev,
      mapeamentoItens: { ...prev.mapeamentoItens, [termo]: grupo as any }
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Configurações DRE & Impostos</h3>
          <p className="text-sm text-muted-foreground">
            Configure como suas transações serão classificadas no Demonstrativo de Resultado
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={aplicarPadroesFotografos}>
            Padrões Fotógrafo
          </Button>
          <Button onClick={salvarConfig}>
            Salvar Configurações
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Regime Tributário */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building className="h-4 w-4" />
              Regime Tributário
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Regime</Label>
              <Select 
                value={config.regimeTributario} 
                onValueChange={(value) => updateConfig('regimeTributario', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEI">MEI</SelectItem>
                  <SelectItem value="Simples">Simples Nacional</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Alíquota sobre Receita (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={config.aliquotaTributariaSobreReceita}
                  onChange={(e) => updateConfig('aliquotaTributariaSobreReceita', parseFloat(e.target.value) || 0)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>ISS sobre Receita (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={config.issSobreReceita}
                  onChange={(e) => updateConfig('issSobreReceita', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch 
                id="incluir-iss"
                checked={config.incluirIssRetido}
                onCheckedChange={(checked) => updateConfig('incluirIssRetido', checked)}
              />
              <Label htmlFor="incluir-iss">Incluir ISS retido na fonte</Label>
            </div>
          </CardContent>
        </Card>

        {/* Taxas de Gateway */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Taxas dos Meios de Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(config.gatewayFees).map(([meio, taxa]) => (
              <div key={meio} className="flex items-center gap-2">
                <Label className="w-20 capitalize">{meio}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={taxa}
                  onChange={(e) => updateGatewayFee(meio, parseFloat(e.target.value) || 0)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Configurações Pessoal */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Pessoal & Encargos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Carga de Encargos (%)</Label>
              <Input
                type="number"
                step="1"
                value={config.opexPessoalCargaEncargos}
                onChange={(e) => updateConfig('opexPessoalCargaEncargos', parseFloat(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                Percentual adicional aplicado sobre salários para encargos (INSS, FGTS, etc.)
              </p>
            </div>

            <Separator />

            <div className="flex items-center space-x-2">
              <Switch 
                id="prolabore-opex"
                checked={config.proLaboreComoOpex}
                onCheckedChange={(checked) => updateConfig('proLaboreComoOpex', checked)}
              />
              <Label htmlFor="prolabore-opex">Incluir pró-labore no EBITDA</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Se desabilitado, pró-labore será tratado como distribuição de lucros
            </p>
          </CardContent>
        </Card>

        {/* Outras Configurações */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Outras Configurações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>PDD - Provisão para Devedores Duvidosos (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={config.pddPercentual}
                onChange={(e) => updateConfig('pddPercentual', parseFloat(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                Percentual sobre receitas para provisionar perdas com inadimplência
              </p>
            </div>

            <div className="space-y-2">
              <Label>Depreciação Padrão (meses)</Label>
              <Input
                type="number"
                value={config.depreciacaoMesesDefault}
                onChange={(e) => updateConfig('depreciacaoMesesDefault', parseInt(e.target.value) || 24)}
              />
              <p className="text-xs text-muted-foreground">
                Prazo em meses para depreciar equipamentos e investimentos
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mapeamento de Itens */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mapeamento de Itens para Grupos DRE</CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure como itens específicos serão classificados no DRE
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(config.mapeamentoItens).map(([termo, grupo]) => (
              <div key={termo} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                <span className="text-sm font-medium flex-1">{termo}</span>
                <Badge variant="outline" className="text-xs">
                  {grupo.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Badge>
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
            <h4 className="font-medium text-sm mb-2">Grupos DRE Disponíveis:</h4>
            <div className="flex flex-wrap gap-2">
              {[
                'cogs', 'opex_pessoal', 'opex_adm', 'opex_marketing', 
                'opex_vendas', 'opex_outros', 'depreciacao'
              ].map(grupo => (
                <Badge key={grupo} variant="secondary" className="text-xs">
                  {grupo.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}