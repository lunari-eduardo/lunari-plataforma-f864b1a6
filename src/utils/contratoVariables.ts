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
  // ========== PADRÃO RECOMENDADO ==========
  // Cliente
  { key: 'nome_cliente', label: 'Nome do cliente', grupo: 'padrao', exemplo: 'João da Silva' },
  { key: 'cpf_cliente', label: 'CPF do cliente', grupo: 'padrao', exemplo: '000.000.000-00' },
  { key: 'rg_cliente', label: 'RG do cliente (manual)', grupo: 'padrao', exemplo: '00.000.000-0' },
  { key: 'documento_cliente', label: 'Documento do cliente (CPF/CNPJ)', grupo: 'padrao' },
  { key: 'cidade_cliente', label: 'Cidade do cliente (manual)', grupo: 'padrao' },
  { key: 'estado_cliente', label: 'Estado do cliente (manual)', grupo: 'padrao' },
  { key: 'email_cliente', label: 'E-mail do cliente', grupo: 'padrao' },
  { key: 'nome_bebe', label: 'Nome do bebê (newborn — manual)', grupo: 'padrao' },

  // Fotógrafo
  { key: 'nome_fotografo', label: 'Nome do fotógrafo', grupo: 'padrao', exemplo: 'Estúdio Lunari' },
  { key: 'documento_fotografo', label: 'CPF/CNPJ do fotógrafo', grupo: 'padrao' },
  { key: 'cidade_fotografo', label: 'Cidade do fotógrafo', grupo: 'padrao' },
  { key: 'email_fotografo', label: 'E-mail do fotógrafo', grupo: 'padrao' },

  // Sessão / Evento
  { key: 'data_sessao', label: 'Data da sessão', grupo: 'padrao', exemplo: '15/06/2026' },
  { key: 'data_evento', label: 'Data do evento', grupo: 'padrao' },
  { key: 'horario_sessao', label: 'Horário da sessão', grupo: 'padrao', exemplo: '14:00' },
  { key: 'horario_inicio', label: 'Horário de início', grupo: 'padrao' },
  { key: 'horario_termino', label: 'Horário de término (manual)', grupo: 'padrao' },
  { key: 'duracao_sessao', label: 'Duração da sessão em horas (manual)', grupo: 'padrao' },
  { key: 'duracao_maxima', label: 'Duração máxima em horas (manual)', grupo: 'padrao' },
  { key: 'tipo_ensaio', label: 'Tipo / categoria do ensaio', grupo: 'padrao', exemplo: 'Casamento' },
  { key: 'tipo_evento', label: 'Tipo do evento (manual)', grupo: 'padrao' },
  { key: 'local_ensaio', label: 'Local do ensaio (manual)', grupo: 'padrao' },
  { key: 'local_evento', label: 'Local do evento (manual)', grupo: 'padrao' },

  // Comerciais
  { key: 'valor_total', label: 'Valor total', grupo: 'padrao', exemplo: 'R$ 2.500,00' },
  { key: 'valor_sinal', label: 'Valor do sinal/arras (manual)', grupo: 'manual' },
  { key: 'valor_hora_extra', label: 'Valor da hora extra (manual)', grupo: 'manual' },
  { key: 'valor_foto_extra', label: 'Valor da foto extra (manual)', grupo: 'manual' },
  { key: 'taxa_deslocamento', label: 'Taxa de deslocamento (manual)', grupo: 'manual' },
  { key: 'valor_taxa_dano', label: 'Taxa de dano ao acervo (manual)', grupo: 'manual' },
  { key: 'forma_pagamento', label: 'Forma de pagamento (manual)', grupo: 'manual', exemplo: 'PIX / Cartão / À vista' },
  { key: 'descricao_forma_pagamento', label: 'Descrição completa da forma de pagamento (manual)', grupo: 'manual' },
  { key: 'quantidade_fotos', label: 'Quantidade de fotos (manual)', grupo: 'manual' },
  { key: 'prazo_entrega', label: 'Prazo de entrega em dias úteis (manual)', grupo: 'manual', exemplo: '30' },
  { key: 'prazo_entrega_final', label: 'Prazo de entrega final em dias úteis (manual)', grupo: 'manual' },
  { key: 'prazo_selecao', label: 'Prazo de seleção em dias úteis (manual)', grupo: 'manual' },
  { key: 'dias_aviso_previo', label: 'Dias de aviso prévio para reagendar (manual)', grupo: 'manual' },
  { key: 'dias_multa_cancelamento', label: 'Dias para multa de cancelamento (manual)', grupo: 'manual' },
  { key: 'porcentagem_multa', label: 'Porcentagem da multa (manual)', grupo: 'manual' },
  { key: 'fornecimento_figurino', label: 'Fornecimento de figurino (manual)', grupo: 'manual' },

  // Cliente (legado)
  { key: 'cliente_nome', label: 'Nome do cliente (legado)', grupo: 'cliente' },
  { key: 'cliente_email', label: 'E-mail do cliente (legado)', grupo: 'cliente' },
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
  { key: 'fotografo_email', label: 'E-mail do fotógrafo (legado)', grupo: 'fotografo' },

  // Contrato
  { key: 'data_atual', label: 'Data atual', grupo: 'contrato', exemplo: new Date().toLocaleDateString('pt-BR') },
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
    cidade?: string | null;
    estado?: string | null;
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
    cidade?: string | null;
    documento?: string | null;
  } | null;
  /** Campos manuais opcionais preenchidos no momento da geração do contrato */
  manuais?: {
    forma_pagamento?: string | null;
    prazo_entrega?: string | null;
    cpf_cliente?: string | null;
    rg_cliente?: string | null;
    nome_bebe?: string | null;
    [key: string]: string | null | undefined;
  } | null;
}

export function buildVariableMap(input: BuildVariablesInput): Record<string, string> {
  const { cliente, sessao, fotografo, manuais } = input;

  const nomeCliente = cliente?.nome || '';
  const cpfCliente = manuais?.cpf_cliente || cliente?.cpf || '';
  const emailCliente = cliente?.email || '';
  const cidadeCliente = cliente?.cidade || '';
  const estadoCliente = cliente?.estado || '';
  const telefone = cliente?.telefone || cliente?.whatsapp || '';
  const dataSessao = formatDateBR(sessao?.data_sessao);
  const horaSessao = sessao?.hora_sessao || '';
  const categoria = sessao?.categoria || '';
  const valorTotal = sessao?.valor_total != null ? formatBRL(sessao.valor_total) : '';
  const nomeFotografo = fotografo?.nome || '';
  const emailFotografo = fotografo?.email || '';
  const cidadeFotografo = fotografo?.cidade || '';
  const documentoFotografo = fotografo?.documento || '';

  return {
    // ========== Padrão novo (recomendado) ==========
    // Cliente
    nome_cliente: nomeCliente,
    cpf_cliente: cpfCliente,
    rg_cliente: manuais?.rg_cliente || '',
    documento_cliente: cpfCliente, // CPF ou CNPJ — usa o mesmo campo
    cidade_cliente: cidadeCliente,
    estado_cliente: estadoCliente,
    email_cliente: emailCliente,
    nome_bebe: manuais?.nome_bebe || '',

    // Fotógrafo
    nome_fotografo: nomeFotografo,
    documento_fotografo: documentoFotografo,
    cidade_fotografo: cidadeFotografo,
    email_fotografo: emailFotografo,

    // Sessão / Evento
    data_sessao: dataSessao,
    data_evento: dataSessao, // mesmo dado, alias semântico
    horario_sessao: horaSessao,
    horario_inicio: horaSessao, // alias
    horario_termino: manuais?.horario_termino || '',
    duracao_sessao: manuais?.duracao_sessao || '',
    duracao_maxima: manuais?.duracao_maxima || '',
    tipo_ensaio: categoria,
    tipo_evento: categoria, // alias
    local_ensaio: manuais?.local_ensaio || cliente?.endereco || '',
    local_evento: manuais?.local_evento || cliente?.endereco || '',

    // Comerciais
    valor_total: valorTotal,
    valor_sinal: manuais?.valor_sinal || '',
    valor_hora_extra: manuais?.valor_hora_extra || '',
    valor_foto_extra: manuais?.valor_foto_extra || '',
    taxa_deslocamento: manuais?.taxa_deslocamento || '',
    valor_taxa_dano: manuais?.valor_taxa_dano || '',
    forma_pagamento: manuais?.forma_pagamento || '',
    descricao_forma_pagamento: manuais?.descricao_forma_pagamento || '',
    quantidade_fotos: manuais?.quantidade_fotos || '',
    prazo_entrega: manuais?.prazo_entrega || '',
    prazo_entrega_final: manuais?.prazo_entrega_final || '',
    prazo_selecao: manuais?.prazo_selecao || '',
    dias_aviso_previo: manuais?.dias_aviso_previo || '',
    dias_multa_cancelamento: manuais?.dias_multa_cancelamento || '',
    porcentagem_multa: manuais?.porcentagem_multa || '',
    fornecimento_figurino: manuais?.fornecimento_figurino || '',

    // ========== Padrão legado (compatibilidade com modelos antigos) ==========
    cliente_nome: nomeCliente,
    cliente_email: emailCliente,
    cliente_telefone: telefone,
    cliente_endereco: cliente?.endereco || '',

    sessao_data: dataSessao,
    sessao_hora: horaSessao,
    sessao_categoria: categoria,
    sessao_pacote: sessao?.pacote || '',
    sessao_descricao: sessao?.descricao || '',
    sessao_valor_total: valorTotal,

    fotografo_nome: nomeFotografo,
    fotografo_email: emailFotografo,

    data_atual: new Date().toLocaleDateString('pt-BR'),
    cidade_atual: cidadeFotografo || '__________',
  };
}

/**
 * Substitui {{variavel}} no HTML pelo valor correspondente.
 * Variáveis não encontradas (ou vazias) são mantidas como placeholder visível em amarelo.
 */
export function applyVariables(html: string, variables: Record<string, string>): string {
  if (!html) return '';
  return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    if (key in variables) {
      const value = variables[key];
      return value || `<span style="background:#fef3c7;padding:0 4px;border-radius:3px;color:#92400e;">[${key}]</span>`;
    }
    return match;
  });
}
