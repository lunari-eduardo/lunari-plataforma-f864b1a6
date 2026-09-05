export const SESSION_REF = {
  sessionId: { type: "string", description: "UUID da sessão ou o código de texto (ex.: workflow-123)." },
  clienteNome: { type: "string", description: "Nome do cliente — usado quando o sessionId não é conhecido." },
  latest: { type: "boolean", description: "Se o cliente tiver várias sessões, usar a mais recente." },
} as const;

export const FAIXAS_PROP = {
  type: "array",
  description: "Faixas progressivas: contíguas, começando em 1, a última com max nulo (ou mais).",
  items: {
    type: "object",
    properties: {
      min: { type: "number" },
      max: { type: "number", description: "Deixe ausente/nulo na última faixa." },
      valor: { type: "number", description: "Valor por foto em reais." },
    },
    required: ["min", "valor"],
    additionalProperties: false,
  },
} as const;

export const PRODUTOS_PROP = {
  type: "array",
  description: "Produtos inclusos com custo unitário.",
  items: {
    type: "object",
    properties: {
      nome: { type: "string" },
      custo: { type: "number", description: "Custo unitário em reais." },
      quantidade: { type: "number" },
    },
    required: ["custo"],
    additionalProperties: false,
  },
} as const;

export const CUSTOS_PROP = {
  type: "array",
  description: "Custos extras do trabalho (deslocamento, assistente, locação...).",
  items: {
    type: "object",
    properties: {
      descricao: { type: "string" },
      valorUnitario: { type: "number" },
      quantidade: { type: "number" },
    },
    required: ["valorUnitario"],
    additionalProperties: false,
  },
} as const;
