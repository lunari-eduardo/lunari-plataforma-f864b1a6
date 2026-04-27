/**
 * Sistema de variáveis dinâmicas para contratos
 *
 * Existem três tipos de variáveis:
 *  - 'auto'     → Preenchidas automaticamente do banco (cliente, sessão, fotógrafo).
 *                 Renderizadas em azul como chip de leitura.
 *  - 'editavel' → Não existem no sistema; recebem um VALOR SUGERIDO PADRÃO e são
 *                 renderizadas como campo destacado em amarelo (editável inline).
 *  - 'legacy'   → Compatibilidade com modelos antigos. Resolvidas como auto.
 *
 * Mantém DOIS padrões em paralelo:
 *  - Legado: cliente_nome, sessao_data, fotografo_nome...
 *  - Novo padrão (recomendado): nome_cliente, data_sessao, nome_fotografo...
 */

export type ContratoVarTipo = 'auto' | 'editavel' | 'legacy';

export interface ContratoVariavelDef {
  key: string;
  label: string;
  /** Tipo da variável — define renderização e UX. */
  tipo: ContratoVarTipo;
  /** Grupo legado mantido para retrocompatibilidade. */
  grupo: 'padrao' | 'cliente' | 'sessao' | 'fotografo' | 'contrato' | 'manual';
  exemplo?: string;
}

export const VARIAVEIS_DISPONIVEIS: ContratoVariavelDef[] = [
  // ========== AUTOMÁTICAS (vêm do sistema) ==========
  // Cliente
  { key: 'nome_cliente', label: 'Nome do cliente', tipo: 'auto', grupo: 'padrao', exemplo: 'João da Silva' },
  { key: 'cpf_cliente', label: 'CPF do cliente', tipo: 'auto', grupo: 'padrao', exemplo: '000.000.000-00' },
  { key: 'documento_cliente', label: 'Documento do cliente (CPF/CNPJ)', tipo: 'auto', grupo: 'padrao' },
  { key: 'email_cliente', label: 'E-mail do cliente', tipo: 'auto', grupo: 'padrao' },

  // Fotógrafo
  { key: 'nome_fotografo', label: 'Nome do fotógrafo', tipo: 'auto', grupo: 'padrao', exemplo: 'Estúdio Lunari' },
  { key: 'documento_fotografo', label: 'CPF/CNPJ do fotógrafo', tipo: 'auto', grupo: 'padrao' },
  { key: 'cidade_fotografo', label: 'Cidade do fotógrafo', tipo: 'auto', grupo: 'padrao' },
  { key: 'email_fotografo', label: 'E-mail do fotógrafo', tipo: 'auto', grupo: 'padrao' },

  // Sessão / Evento
  { key: 'data_sessao', label: 'Data da sessão', tipo: 'auto', grupo: 'padrao', exemplo: '15/06/2026' },
  { key: 'data_evento', label: 'Data do evento', tipo: 'auto', grupo: 'padrao' },
  { key: 'horario_sessao', label: 'Horário da sessão', tipo: 'auto', grupo: 'padrao', exemplo: '14:00' },
  { key: 'horario_inicio', label: 'Horário de início', tipo: 'auto', grupo: 'padrao' },
  { key: 'tipo_ensaio', label: 'Tipo / categoria do ensaio', tipo: 'auto', grupo: 'padrao', exemplo: 'Casamento' },
  { key: 'tipo_evento', label: 'Tipo do evento', tipo: 'auto', grupo: 'padrao' },
  { key: 'valor_total', label: 'Valor total', tipo: 'auto', grupo: 'padrao', exemplo: 'R$ 2.500,00' },

  // Sistema
  { key: 'data_atual', label: 'Data atual', tipo: 'auto', grupo: 'contrato', exemplo: new Date().toLocaleDateString('pt-BR') },

  // ========== EDITÁVEIS (campo destacado com sugestão padrão) ==========
  { key: 'rg_cliente', label: 'RG do cliente', tipo: 'editavel', grupo: 'manual' },
  { key: 'cidade_cliente', label: 'Cidade do cliente', tipo: 'editavel', grupo: 'manual' },
  { key: 'estado_cliente', label: 'Estado do cliente', tipo: 'editavel', grupo: 'manual' },
  { key: 'nome_bebe', label: 'Nome do bebê (newborn)', tipo: 'editavel', grupo: 'manual' },

  { key: 'horario_termino', label: 'Horário de término', tipo: 'editavel', grupo: 'manual' },
  { key: 'duracao_sessao', label: 'Duração da sessão', tipo: 'editavel', grupo: 'manual' },
  { key: 'duracao_maxima', label: 'Duração máxima', tipo: 'editavel', grupo: 'manual' },
  { key: 'local_ensaio', label: 'Local do ensaio', tipo: 'editavel', grupo: 'manual' },
  { key: 'local_evento', label: 'Local do evento', tipo: 'editavel', grupo: 'manual' },

  { key: 'valor_sinal', label: 'Valor do sinal/arras', tipo: 'editavel', grupo: 'manual' },
  { key: 'valor_hora_extra', label: 'Valor da hora extra', tipo: 'editavel', grupo: 'manual' },
  { key: 'valor_foto_extra', label: 'Valor da foto extra', tipo: 'editavel', grupo: 'manual' },
  { key: 'taxa_deslocamento', label: 'Taxa de deslocamento', tipo: 'editavel', grupo: 'manual' },
  { key: 'valor_taxa_dano', label: 'Taxa de dano ao acervo', tipo: 'editavel', grupo: 'manual' },
  { key: 'forma_pagamento', label: 'Forma de pagamento', tipo: 'editavel', grupo: 'manual', exemplo: 'PIX / Cartão' },
  { key: 'descricao_forma_pagamento', label: 'Descrição da forma de pagamento', tipo: 'editavel', grupo: 'manual' },
  { key: 'quantidade_fotos', label: 'Quantidade de fotos', tipo: 'editavel', grupo: 'manual' },
  { key: 'prazo_entrega', label: 'Prazo de entrega', tipo: 'editavel', grupo: 'manual', exemplo: '30 dias úteis' },
  { key: 'prazo_entrega_final', label: 'Prazo de entrega final', tipo: 'editavel', grupo: 'manual' },
  { key: 'prazo_selecao', label: 'Prazo de seleção', tipo: 'editavel', grupo: 'manual' },
  { key: 'dias_aviso_previo', label: 'Dias de aviso prévio', tipo: 'editavel', grupo: 'manual' },
  { key: 'dias_multa_cancelamento', label: 'Dias para multa de cancelamento', tipo: 'editavel', grupo: 'manual' },
  { key: 'porcentagem_multa', label: 'Porcentagem da multa', tipo: 'editavel', grupo: 'manual' },
  { key: 'fornecimento_figurino', label: 'Fornecimento de figurino', tipo: 'editavel', grupo: 'manual' },

  // ========== LEGADAS (compatibilidade) ==========
  { key: 'cliente_nome', label: 'Nome do cliente (legado)', tipo: 'legacy', grupo: 'cliente' },
  { key: 'cliente_email', label: 'E-mail do cliente (legado)', tipo: 'legacy', grupo: 'cliente' },
  { key: 'cliente_telefone', label: 'Telefone do cliente', tipo: 'legacy', grupo: 'cliente' },
  { key: 'cliente_endereco', label: 'Endereço do cliente', tipo: 'legacy', grupo: 'cliente' },
  { key: 'sessao_data', label: 'Data da sessão (legado)', tipo: 'legacy', grupo: 'sessao' },
  { key: 'sessao_hora', label: 'Hora da sessão (legado)', tipo: 'legacy', grupo: 'sessao' },
  { key: 'sessao_categoria', label: 'Categoria (legado)', tipo: 'legacy', grupo: 'sessao' },
  { key: 'sessao_pacote', label: 'Pacote', tipo: 'legacy', grupo: 'sessao' },
  { key: 'sessao_descricao', label: 'Descrição', tipo: 'legacy', grupo: 'sessao' },
  { key: 'sessao_valor_total', label: 'Valor total (legado)', tipo: 'legacy', grupo: 'sessao' },
  { key: 'fotografo_nome', label: 'Nome do fotógrafo (legado)', tipo: 'legacy', grupo: 'fotografo' },
  { key: 'fotografo_email', label: 'E-mail do fotógrafo (legado)', tipo: 'legacy', grupo: 'fotografo' },
  { key: 'cidade_atual', label: 'Cidade atual', tipo: 'legacy', grupo: 'manual' },
];

/**
 * Sugestões padrão para campos editáveis. São inseridas no contrato como
 * texto destacado quando o campo não tem valor real — o usuário ajusta direto no editor.
 */
export const CAMPOS_EDITAVEIS_DEFAULTS: Record<string, string> = {
  rg_cliente: 'a informar',
  cidade_cliente: 'a definir',
  estado_cliente: '--',
  nome_bebe: 'a informar',

  horario_termino: 'a definir',
  duracao_sessao: '2 horas',
  duracao_maxima: '4 horas',
  local_ensaio: 'a definir',
  local_evento: 'a definir',

  valor_sinal: 'R$ 0,00',
  valor_hora_extra: 'R$ 0,00',
  valor_foto_extra: 'R$ 0,00',
  taxa_deslocamento: 'R$ 0,00',
  valor_taxa_dano: 'R$ 0,00',
  forma_pagamento: 'PIX / Cartão / Transferência',
  descricao_forma_pagamento: '30% de sinal + saldo até 5 dias antes do evento',
  quantidade_fotos: '20 fotos tratadas',
  prazo_entrega: '30 dias úteis',
  prazo_entrega_final: '45 dias úteis',
  prazo_selecao: '15 dias úteis',
  dias_aviso_previo: '7',
  dias_multa_cancelamento: '30',
  porcentagem_multa: '50',
  fornecimento_figurino: 'não está incluso',
};

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
    nome_cliente: nomeCliente,
    cpf_cliente: cpfCliente,
    rg_cliente: manuais?.rg_cliente || '',
    documento_cliente: cpfCliente,
    cidade_cliente: cidadeCliente,
    estado_cliente: estadoCliente,
    email_cliente: emailCliente,
    nome_bebe: manuais?.nome_bebe || '',

    nome_fotografo: nomeFotografo,
    documento_fotografo: documentoFotografo,
    cidade_fotografo: cidadeFotografo,
    email_fotografo: emailFotografo,

    data_sessao: dataSessao,
    data_evento: dataSessao,
    horario_sessao: horaSessao,
    horario_inicio: horaSessao,
    horario_termino: manuais?.horario_termino || '',
    duracao_sessao: manuais?.duracao_sessao || '',
    duracao_maxima: manuais?.duracao_maxima || '',
    tipo_ensaio: categoria,
    tipo_evento: categoria,
    local_ensaio: manuais?.local_ensaio || cliente?.endereco || '',
    local_evento: manuais?.local_evento || cliente?.endereco || '',

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
 * Substitui {{variavel}} no HTML conforme regras:
 *  - Variável com valor real → <span class="contrato-var-auto">valor</span>
 *  - Variável sem valor mas com sugestão default → <span class="contrato-campo-editavel">sugestão</span>
 *  - Variável desconhecida → mantém {{variavel}} (não polui o conteúdo)
 *
 * Os spans são editáveis no editor (contentEditable) — o usuário simplesmente
 * clica e digita por cima para ajustar.
 */
export function applyVariables(
  html: string,
  variables: Record<string, string>,
  defaults: Record<string, string> = CAMPOS_EDITAVEIS_DEFAULTS
): string {
  if (!html) return '';
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    const value = variables[key];
    if (value && value.trim() !== '') {
      return `<span class="contrato-var-auto" data-campo="${key}">${escape(value)}</span>`;
    }
    if (key in defaults) {
      return `<span class="contrato-campo-editavel" data-campo="${key}">${escape(defaults[key])}</span>`;
    }
    // Variável desconhecida → preserva o token original (não destaca como erro)
    return match;
  });
}
