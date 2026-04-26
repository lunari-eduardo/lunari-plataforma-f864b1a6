/**
 * Sistema de variáveis dinâmicas para contratos
 * Substitui {{variavel}} por dados reais do cliente, sessão e fotógrafo.
 */

export interface ContratoVariavelDef {
  key: string;
  label: string;
  grupo: 'cliente' | 'sessao' | 'fotografo' | 'contrato';
  exemplo?: string;
}

export const VARIAVEIS_DISPONIVEIS: ContratoVariavelDef[] = [
  // Cliente
  { key: 'cliente_nome', label: 'Nome do cliente', grupo: 'cliente', exemplo: 'João da Silva' },
  { key: 'cliente_email', label: 'E-mail do cliente', grupo: 'cliente', exemplo: 'joao@email.com' },
  { key: 'cliente_telefone', label: 'Telefone do cliente', grupo: 'cliente', exemplo: '(11) 99999-9999' },
  { key: 'cliente_endereco', label: 'Endereço do cliente', grupo: 'cliente', exemplo: 'Rua X, 123' },

  // Sessão
  { key: 'sessao_data', label: 'Data da sessão', grupo: 'sessao', exemplo: '15/06/2026' },
  { key: 'sessao_hora', label: 'Hora da sessão', grupo: 'sessao', exemplo: '14:00' },
  { key: 'sessao_categoria', label: 'Categoria', grupo: 'sessao', exemplo: 'Casamento' },
  { key: 'sessao_pacote', label: 'Pacote', grupo: 'sessao', exemplo: 'Pacote Premium' },
  { key: 'sessao_descricao', label: 'Descrição', grupo: 'sessao', exemplo: 'Sessão externa' },
  { key: 'sessao_valor_total', label: 'Valor total', grupo: 'sessao', exemplo: 'R$ 2.500,00' },

  // Fotógrafo
  { key: 'fotografo_nome', label: 'Nome do fotógrafo', grupo: 'fotografo', exemplo: 'Estúdio Lunari' },
  { key: 'fotografo_email', label: 'E-mail do fotógrafo', grupo: 'fotografo' },

  // Contrato
  { key: 'data_atual', label: 'Data atual', grupo: 'contrato', exemplo: '26/04/2026' },
  { key: 'cidade_atual', label: 'Cidade (preencher manual)', grupo: 'contrato', exemplo: '__________' },
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
}

export function buildVariableMap(input: BuildVariablesInput): Record<string, string> {
  const { cliente, sessao, fotografo } = input;
  return {
    cliente_nome: cliente?.nome || '',
    cliente_email: cliente?.email || '',
    cliente_telefone: cliente?.telefone || cliente?.whatsapp || '',
    cliente_endereco: cliente?.endereco || '',

    sessao_data: formatDateBR(sessao?.data_sessao),
    sessao_hora: sessao?.hora_sessao || '',
    sessao_categoria: sessao?.categoria || '',
    sessao_pacote: sessao?.pacote || '',
    sessao_descricao: sessao?.descricao || '',
    sessao_valor_total: sessao?.valor_total != null ? formatBRL(sessao.valor_total) : '',

    fotografo_nome: fotografo?.nome || '',
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
