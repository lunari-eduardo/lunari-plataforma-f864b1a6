/**
 * Sistema de variáveis dinâmicas para contratos
 * Substitui {{variavel}} por dados reais do cliente, sessão e fotógrafo.
 *
 * Mantém DOIS padrões em paralelo:
 *  - Legado: cliente_nome, sessao_data, fotografo_nome...
 *  - Novo padrão (recomendado): nome_cliente, data_sessao, nome_fotografo...
 *
 * Ambos resolvem para os mesmos valores. Modelos antigos continuam funcionando.
 */

export interface ContratoVariavelDef {
  key: string;
  label: string;
  grupo: 'padrao' | 'cliente' | 'sessao' | 'fotografo' | 'contrato' | 'manual';
  exemplo?: string;
}

export const VARIAVEIS_DISPONIVEIS: ContratoVariavelDef[] = [
  // Padrão recomendado (novo) — usado pelos modelos prontos
  { key: 'nome_cliente', label: 'Nome do cliente', grupo: 'padrao', exemplo: 'João da Silva' },
  { key: 'cpf_cliente', label: 'CPF do cliente (manual)', grupo: 'padrao', exemplo: '000.000.000-00' },
  { key: 'nome_fotografo', label: 'Nome do fotógrafo', grupo: 'padrao', exemplo: 'Estúdio Lunari' },
  { key: 'data_sessao', label: 'Data da sessão', grupo: 'padrao', exemplo: '15/06/2026' },
  { key: 'horario_sessao', label: 'Horário da sessão', grupo: 'padrao', exemplo: '14:00' },
  { key: 'tipo_ensaio', label: 'Tipo / categoria', grupo: 'padrao', exemplo: 'Casamento' },
  { key: 'valor_total', label: 'Valor total', grupo: 'padrao', exemplo: 'R$ 2.500,00' },
  { key: 'forma_pagamento', label: 'Forma de pagamento (manual)', grupo: 'padrao', exemplo: 'PIX / Cartão / À vista' },
  { key: 'prazo_entrega', label: 'Prazo de entrega em dias (manual)', grupo: 'padrao', exemplo: '30' },

  // Cliente (legado)
  { key: 'cliente_nome', label: 'Nome do cliente (legado)', grupo: 'cliente' },
  { key: 'cliente_email', label: 'E-mail do cliente', grupo: 'cliente' },
  { key: 'cliente_telefone', label: 'Telefone do cliente', grupo: 'cliente' },
  { key: 'cliente_endereco', label: 'Endereço do cliente', grupo: 'cliente' },

  // Sessão (legado)
  { key: 'sessao_data', label: 'Data da sessão (legado)', grupo: 'sessao' },
  { key: 'sessao_hora', label: 'Hora da sessão (legado)', grupo: 'sessao' },
  { key: 'sessao_categoria', label: 'Categoria (legado)', grupo: 'sessao' },
  { key: 'sessao_pacote', label: 'Pacote', grupo: 'sessao' },
  { key: 'sessao_descricao', label: 'Descrição', grupo: 'sessao' },
  { key: 'sessao_valor_total', label: 'Valor total (legado)', grupo: 'sessao' },

  // Fotógrafo (legado)
  { key: 'fotografo_nome', label: 'Nome do fotógrafo (legado)', grupo: 'fotografo' },
  { key: 'fotografo_email', label: 'E-mail do fotógrafo', grupo: 'fotografo' },

  // Contrato
  { key: 'data_atual', label: 'Data atual', grupo: 'contrato', exemplo: '26/04/2026' },
  { key: 'cidade_atual', label: 'Cidade (preencher manual)', grupo: 'manual' },
];

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const formatDateBR = (date?: string | null) => {
  if (!date) return '';
  try {
    const d = new Date(date.includes('T') ? date : `${date}T00:00:00`);
    return d.toLocaleDateString('pt-BR');
  } catch {
    return date;
  }
};

export interface BuildVariablesInput {
  cliente?: {
    nome?: string;
    email?: string | null;
    telefone?: string | null;
    whatsapp?: string | null;
    endereco?: string | null;
    cpf?: string | null;
  } | null;
  sessao?: {
    data_sessao?: string | null;
    hora_sessao?: string | null;
    categoria?: string | null;
    pacote?: string | null;
    descricao?: string | null;
    valor_total?: number | null;
  } | null;
  fotografo?: {
    nome?: string | null;
    email?: string | null;
  } | null;
  /** Campos manuais opcionais preenchidos no momento da geração do contrato */
  manuais?: {
    forma_pagamento?: string | null;
    prazo_entrega?: string | null;
    cpf_cliente?: string | null;
  } | null;
}

export function buildVariableMap(input: BuildVariablesInput): Record<string, string> {
  const { cliente, sessao, fotografo, manuais } = input;

  const nomeCliente = cliente?.nome || '';
  const telefone = cliente?.telefone || cliente?.whatsapp || '';
  const dataSessao = formatDateBR(sessao?.data_sessao);
  const horaSessao = sessao?.hora_sessao || '';
  const categoria = sessao?.categoria || '';
  const valorTotal = sessao?.valor_total != null ? formatBRL(sessao.valor_total) : '';
  const nomeFotografo = fotografo?.nome || '';

  return {
    // Padrão novo (recomendado)
    nome_cliente: nomeCliente,
    cpf_cliente: manuais?.cpf_cliente || cliente?.cpf || '',
    nome_fotografo: nomeFotografo,
    data_sessao: dataSessao,
    horario_sessao: horaSessao,
    tipo_ensaio: categoria,
    valor_total: valorTotal,
    forma_pagamento: manuais?.forma_pagamento || '',
    prazo_entrega: manuais?.prazo_entrega || '',

    // Padrão legado (compatibilidade com modelos antigos)
    cliente_nome: nomeCliente,
    cliente_email: cliente?.email || '',
    cliente_telefone: telefone,
    cliente_endereco: cliente?.endereco || '',

    sessao_data: dataSessao,
    sessao_hora: horaSessao,
    sessao_categoria: categoria,
    sessao_pacote: sessao?.pacote || '',
    sessao_descricao: sessao?.descricao || '',
    sessao_valor_total: valorTotal,

    fotografo_nome: nomeFotografo,
    fotografo_email: fotografo?.email || '',

    data_atual: new Date().toLocaleDateString('pt-BR'),
    cidade_atual: '__________',
  };
}

/**
 * Substitui {{variavel}} no HTML pelo valor correspondente.
 * Variáveis não encontradas são mantidas como placeholder visível.
 */
export function applyVariables(html: string, variables: Record<string, string>): string {
  if (!html) return '';
  return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    if (key in variables) {
      const value = variables[key];
      return value || `<span style="background:#fef3c7;padding:0 4px;border-radius:3px;">[${key}]</span>`;
    }
    return match;
  });
}
