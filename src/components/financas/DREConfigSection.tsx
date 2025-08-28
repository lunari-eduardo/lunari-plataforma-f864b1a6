import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calculator, Percent, CreditCard, Users, Building, MapPin } from 'lucide-react';
import { DREConfig, DRE_CONFIG_FOTOGRAFOS, DRE_CONFIG_MEI, DREGroupKey } from '@/types/dre';
import { useToast } from '@/hooks/use-toast';
import { useNovoFinancas } from '@/hooks/useNovoFinancas';
import { useRegimeTributario } from '@/hooks/useRegimeTributario';

const DRE_CONFIG_KEY = 'dre_config_v1';

export default function DREConfigSection() {
  const { toast } = useToast();
  const { itensFinanceiros } = useNovoFinancas();
  const { regime, isSimples } = useRegimeTributario();
  
  const [config, setConfig] = useState<DREConfig>(() => {
    const saved = localStorage.getItem(DRE_CONFIG_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const baseConfig = parsed.regimeTributario === 'MEI' ? DRE_CONFIG_MEI : DRE_CONFIG_FOTOGRAFOS;
        return { ...baseConfig, ...parsed } as DREConfig;
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

  const aplicarPadroesMEI = () => {
    setConfig(DRE_CONFIG_MEI as DREConfig);
    toast({
      title: "Padrões MEI Aplicados",
      description: "Configurações padrão para MEI aplicadas com sucesso!"
    });
  };

  const updateConfig = (updates: Partial<DREConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
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
          <Button variant="outline" onClick={aplicarPadroesMEI}>
            Padrões MEI
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
              <Label>Regime Ativo</Label>
              <div className="p-3 bg-muted rounded-lg flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {regime === 'mei' ? 'MEI' : 'Simples Nacional'}
                </span>
                <Badge variant="outline" className="text-xs">
                  Configurado no perfil
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Para alterar o regime tributário, acesse Minha Conta → Regime Tributário
              </p>
            </div>

            {!isSimples() ? (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Percent className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Tributação MEI</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    MEI não paga impostos sobre receita. Apenas a DAS mensal fixa.
                  </p>
                  
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Valor DAS Mensal (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={config.valorDasMensal || 75}
                        onChange={(e) => updateConfig({ valorDasMensal: parseFloat(e.target.value) || 75 })}
                      />
                      <p className="text-2xs text-muted-foreground">
                        Valor fixo mensal da DAS (aprox. R$ 70-90 em 2024)
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch 
                        id="tem-funcionarios"
                        checked={config.temFuncionarios}
                        onCheckedChange={(checked) => updateConfig({ temFuncionarios: checked })}
                      />
                      <Label htmlFor="tem-funcionarios">Possui funcionários com carteira assinada</Label>
                    </div>
                    
                    {config.temFuncionarios && (
                      <p className="text-2xs text-muted-foreground">
                        Encargos trabalhistas serão aplicados sobre salários cadastrados
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Alíquota sobre Receita (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={config.aliquotaTributariaSobreReceita}
                      onChange={(e) => updateConfig({ aliquotaTributariaSobreReceita: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>ISS sobre Receita (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={config.issSobreReceita}
                      onChange={(e) => updateConfig({ issSobreReceita: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch 
                    id="incluir-iss"
                    checked={config.incluirIssRetido}
                    onCheckedChange={(checked) => updateConfig({ incluirIssRetido: checked })}
                  />
                  <Label htmlFor="incluir-iss">Incluir ISS retido na fonte</Label>
                </div>
              </div>
            )}
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
                onChange={(e) => updateConfig({ opexPessoalCargaEncargos: parseFloat(e.target.value) || 0 })}
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
                onCheckedChange={(checked) => updateConfig({ proLaboreComoOpex: checked })}
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
                onChange={(e) => updateConfig({ pddPercentual: parseFloat(e.target.value) || 0 })}
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
                onChange={(e) => updateConfig({ depreciacaoMesesDefault: parseInt(e.target.value) || 24 })}
              />
              <p className="text-xs text-muted-foreground">
                Prazo em meses para depreciar equipamentos e investimentos
              </p>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch 
                  id="usar-depreciacao-equipamentos"
                  checked={config.usarDepreciacaoEquipamentos}
                  onCheckedChange={(checked) => updateConfig({ usarDepreciacaoEquipamentos: checked })}
                />
                <Label htmlFor="usar-depreciacao-equipamentos">Usar depreciação automática de equipamentos</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Quando habilitado, a depreciação será calculada automaticamente com base nos equipamentos 
                cadastrados na precificação, considerando data de compra e vida útil. Transações de "Investimento" 
                serão ignoradas para evitar duplicação.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mapeamento de Itens Financeiros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Mapeamento de Itens para Grupos DRE
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure como cada item financeiro será classificado no DRE. 
            Itens não mapeados usarão classificação automática por grupo principal.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-3">
              {itensFinanceiros
                .filter(item => item.ativo)
                .map(item => {
                  const mapeamentoAtual = config.mapeamentoItens[item.nome.toLowerCase()] || 
                    getGrupoAutomatico(item.grupo_principal);
                  
                  return (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{item.nome}</span>
                        <Badge variant="outline" className="text-xs">
                          {item.grupo_principal}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">→</span>
                        <Select
                          value={mapeamentoAtual}
                          onValueChange={(value: DREGroupKey) => {
                            const newMapping = { ...config.mapeamentoItens };
                            const itemKey = item.nome.toLowerCase();
                            
                            if (value === getGrupoAutomatico(item.grupo_principal)) {
                              // Se voltou ao padrão, remover do mapeamento
                              delete newMapping[itemKey];
                            } else {
                              // Mapear para grupo específico
                              newMapping[itemKey] = value;
                            }
                            
                            updateConfig({ mapeamentoItens: newMapping });
                          }}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="receita_bruta">Receita Bruta</SelectItem>
                            <SelectItem value="cogs">COGS (Custo dos Serviços)</SelectItem>
                            <SelectItem value="opex_pessoal">OPEX - Pessoal</SelectItem>
                            <SelectItem value="opex_adm">OPEX - Administrativo</SelectItem>
                            <SelectItem value="opex_marketing">OPEX - Marketing</SelectItem>
                            <SelectItem value="opex_vendas">OPEX - Vendas</SelectItem>
                            <SelectItem value="opex_outros">OPEX - Outros</SelectItem>
                            <SelectItem value="depreciacao">Depreciação</SelectItem>
                            <SelectItem value="resultado_financeiro">Resultado Financeiro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
            </div>
            
            {itensFinanceiros.filter(item => item.ativo).length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-4">
                Nenhum item financeiro cadastrado. 
                Configure itens na aba "Itens Financeiros" primeiro.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Função auxiliar para obter grupo automático
  function getGrupoAutomatico(grupoPrincipal: string): DREGroupKey {
    switch (grupoPrincipal) {
      case 'Receita Não Operacional':
        return 'receita_bruta';
      case 'Despesa Variável':
        return 'cogs';
      case 'Despesa Fixa':
        return 'opex_adm';
      case 'Investimento':
        return 'depreciacao';
      default:
        return 'opex_outros';
    }
  }
}