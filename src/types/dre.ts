export type DREMode = 'caixa' | 'competencia';

export type DREPeriod = {
  type: 'monthly' | 'annual';
  month?: number;
  year: number;
};

export type DREGroupKey = 
  | 'receita_bruta'
  | 'deducoes'
  | 'receita_liquida'
  | 'cogs'
  | 'lucro_bruto'
  | 'opex_pessoal'
  | 'opex_adm'
  | 'opex_marketing'
  | 'opex_vendas'
  | 'opex_outros'
  | 'ebitda'
  | 'depreciacao'
  | 'resultado_operacional'
  | 'resultado_financeiro'
  | 'resultado_antes_impostos'
  | 'ir_csll'
  | 'lucro_liquido';

export interface DRELine {
  key: DREGroupKey;
  label: string;
  value: number;
  percentageOfNet?: number;
  children?: DRELine[];
  filter?: Record<string, any>;
}

export interface DREConfig {
  regimeTributario: 'MEI' | 'Simples' | 'Outro';
  aliquotaTributariaSobreReceita: number; // %
  issSobreReceita: number; // %
  incluirIssRetido: boolean;
  gatewayFees: { [meio: string]: number }; // ex: { credito: 3.79, pix: 1.0 }
  proLaboreComoOpex: boolean;
  pddPercentual: number;
  depreciacaoMesesDefault: number; // p/ equipamentos
  mapeamentoItens: { [itemIdOuGrupo: string]: DREGroupKey }; // exceções
  opexPessoalCargaEncargos: number; // % adicional sobre salários para encargos
}

export interface DREResult {
  period: DREPeriod;
  mode: DREMode;
  lines: DRELine[];
  kpis: {
    receitaLiquida: number;
    lucroBruto: number;
    ebitda: number;
    lucroLiquido: number;
  };
  // Para comparativo com período anterior
  previousPeriod?: {
    kpis: {
      receitaLiquida: number;
      lucroBruto: number;
      ebitda: number;
      lucroLiquido: number;
    };
    deltaPercentual: {
      receitaLiquida: number;
      lucroBruto: number;
      ebitda: number;
      lucroLiquido: number;
    };
  };
}

// Movimento base para cálculos DRE
export interface DREMovement {
  tipo: 'entrada' | 'saida';
  valor: number;
  origem: 'workflow' | 'financeiro';
  categoria?: string;
  item?: any;
  meioPagamento?: string;
  dataCompetencia: string;
  dataCaixa?: string;
  status?: string;
  meta?: Record<string, any>;
}

// Configuração padrão para fotógrafos
export const DRE_CONFIG_FOTOGRAFOS: Partial<DREConfig> = {
  regimeTributario: 'Simples',
  aliquotaTributariaSobreReceita: 6.0, // Simples Nacional Anexo III
  issSobreReceita: 2.0,
  incluirIssRetido: true,
  gatewayFees: {
    credito: 3.79,
    debito: 2.39,
    pix: 1.0,
    boleto: 1.5
  },
  proLaboreComoOpex: false, // Não incluir no EBITDA por padrão
  pddPercentual: 1.0, // 1% sobre receitas
  depreciacaoMesesDefault: 24, // 2 anos para equipamentos
  opexPessoalCargaEncargos: 35.0, // 35% de encargos sobre salários
  mapeamentoItens: {
    // Padrões para fotógrafos
    'terceiros': 'cogs',
    'laboratorio': 'cogs',
    'album': 'cogs',
    'assistente': 'cogs',
    'editor': 'cogs',
    'marketing': 'opex_marketing',
    'google ads': 'opex_marketing',
    'facebook ads': 'opex_marketing',
    'instagram ads': 'opex_marketing',
    'plataforma': 'cogs',
    'entrega': 'cogs',
    'combustivel': 'opex_vendas',
    'deslocamento': 'opex_vendas',
    'salario': 'opex_pessoal',
    'prolabore': 'opex_pessoal',
    'pró-labore': 'opex_pessoal',
    'equipamento': 'depreciacao',
    'camera': 'depreciacao',
    'lente': 'depreciacao',
    'computador': 'depreciacao'
  }
};