/**
 * Modelos de contrato profissionais prontos para uso.
 * Cobrem os principais segmentos da fotografia: casamento, ensaio, newborn e evento.
 *
 * Padrão de variáveis:
 *  {{nome_cliente}}, {{cpf_cliente}}, {{nome_fotografo}}, {{data_sessao}},
 *  {{horario_sessao}}, {{tipo_ensaio}}, {{valor_total}}, {{forma_pagamento}}, {{prazo_entrega}}
 */

export interface ContratoSeedTemplate {
  slug: 'casamento' | 'ensaio' | 'newborn' | 'evento';
  nome: string;
  descricao: string;
  categoria: string;
  emoji: string;
  conteudo: string;
}

const CASAMENTO = `<h2>Contrato de Prestação de Serviços Fotográficos – Casamento</h2>

<h3>1. Partes</h3>
<p><strong>Contratante:</strong> {{nome_cliente}} – CPF: {{cpf_cliente}}<br/>
<strong>Contratado:</strong> {{nome_fotografo}}</p>

<h3>2. Objeto</h3>
<p>Prestação de serviços fotográficos para cobertura do evento de casamento, a ser realizado na data <strong>{{data_sessao}}</strong>, com início às <strong>{{horario_sessao}}</strong>.</p>

<h3>3. Serviços inclusos</h3>
<p>Cobertura fotográfica conforme pacote contratado, incluindo captação de imagens, tratamento e entrega final.</p>

<h3>4. Prazo de entrega</h3>
<p>O prazo para entrega do material final é de até <strong>{{prazo_entrega}}</strong> dias após a realização do evento.</p>

<h3>5. Valor e forma de pagamento</h3>
<p>O valor total do serviço é de <strong>{{valor_total}}</strong>, a ser pago via <strong>{{forma_pagamento}}</strong>.</p>

<h3>6. Cancelamento e reagendamento</h3>
<p>Cancelamentos devem ser comunicados com antecedência. Valores pagos não são reembolsáveis, podendo ser convertidos em crédito conforme política do contratado.</p>

<h3>7. Direito de imagem</h3>
<p>O contratante autoriza o uso das imagens para fins de divulgação profissional, salvo manifestação contrária por escrito.</p>

<h3>8. Responsabilidades</h3>
<p>O contratado não se responsabiliza por interferências externas, atrasos ou condições que prejudiquem a execução do serviço.</p>

<h3>9. Disposições gerais</h3>
<p>Este contrato entra em vigor na data de sua assinatura.</p>`;

const ENSAIO = `<h2>Contrato de Prestação de Serviços Fotográficos – Ensaio</h2>

<h3>1. Partes</h3>
<p><strong>Contratante:</strong> {{nome_cliente}}<br/>
<strong>Contratado:</strong> {{nome_fotografo}}</p>

<h3>2. Objeto</h3>
<p>Realização de ensaio fotográfico do tipo <strong>{{tipo_ensaio}}</strong>, na data <strong>{{data_sessao}}</strong>.</p>

<h3>3. Serviço</h3>
<p>O ensaio inclui captação, seleção e tratamento das imagens conforme pacote contratado.</p>

<h3>4. Prazo de entrega</h3>
<p>Entrega em até <strong>{{prazo_entrega}}</strong> dias.</p>

<h3>5. Valor</h3>
<p>Valor total de <strong>{{valor_total}}</strong>, pago via <strong>{{forma_pagamento}}</strong>.</p>

<h3>6. Reagendamento</h3>
<p>Permitido mediante aviso prévio e disponibilidade de agenda.</p>

<h3>7. Atrasos</h3>
<p>Atrasos do cliente podem reduzir o tempo de ensaio.</p>

<h3>8. Direito de imagem</h3>
<p>Autorização para uso em portfólio, salvo restrição formal.</p>

<h3>9. Condições gerais</h3>
<p>O cliente declara estar ciente das condições do serviço.</p>`;

const NEWBORN = `<h2>Contrato de Prestação de Serviços Fotográficos – Ensaio Newborn</h2>

<h3>1. Partes</h3>
<p><strong>Contratante:</strong> {{nome_cliente}}<br/>
<strong>Contratado:</strong> {{nome_fotografo}}</p>

<h3>2. Objeto</h3>
<p>Realização de ensaio fotográfico newborn na data <strong>{{data_sessao}}</strong>.</p>

<h3>3. Segurança</h3>
<p>O ensaio será realizado respeitando limites e segurança do bebê. O fotógrafo poderá interromper poses que considere inseguras.</p>

<h3>4. Condições do bebê</h3>
<p>O ensaio depende do estado do bebê (sono, alimentação, bem-estar).</p>

<h3>5. Prazo de entrega</h3>
<p>Entrega em até <strong>{{prazo_entrega}}</strong> dias.</p>

<h3>6. Valor</h3>
<p>Total de <strong>{{valor_total}}</strong> via <strong>{{forma_pagamento}}</strong>.</p>

<h3>7. Reagendamento</h3>
<p>Pode ocorrer em caso de intercorrências com o bebê.</p>

<h3>8. Direito de imagem</h3>
<p>Uso autorizado para portfólio.</p>

<h3>9. Disposições</h3>
<p>O cliente declara ciência das particularidades do ensaio newborn.</p>`;

const EVENTO = `<h2>Contrato de Prestação de Serviços Fotográficos – Evento</h2>

<h3>1. Partes</h3>
<p><strong>Contratante:</strong> {{nome_cliente}}<br/>
<strong>Contratado:</strong> {{nome_fotografo}}</p>

<h3>2. Objeto</h3>
<p>Cobertura fotográfica do evento na data <strong>{{data_sessao}}</strong>.</p>

<h3>3. Serviço</h3>
<p>Registro fotográfico do evento conforme duração e pacote contratado.</p>

<h3>4. Prazo de entrega</h3>
<p>Entrega em até <strong>{{prazo_entrega}}</strong> dias.</p>

<h3>5. Valor</h3>
<p><strong>{{valor_total}}</strong> via <strong>{{forma_pagamento}}</strong>.</p>

<h3>6. Condições de execução</h3>
<p>O contratante deve garantir acesso, iluminação mínima e condições adequadas.</p>

<h3>7. Limitações</h3>
<p>O fotógrafo não se responsabiliza por momentos não registrados devido a fatores externos.</p>

<h3>8. Direito de imagem</h3>
<p>Uso permitido para divulgação.</p>

<h3>9. Disposições gerais</h3>
<p>Contrato válido após assinatura.</p>`;

export const CONTRATO_SEED_TEMPLATES: ContratoSeedTemplate[] = [
  {
    slug: 'casamento',
    nome: 'Contrato — Casamento',
    descricao: 'Cobertura fotográfica de casamento. Inclui cláusulas de cancelamento e direito de imagem.',
    categoria: 'casamento',
    emoji: '💍',
    conteudo: CASAMENTO,
  },
  {
    slug: 'ensaio',
    nome: 'Contrato — Ensaio (geral)',
    descricao: 'Modelo versátil para ensaios fotográficos. Funciona para gestante, família, individual e mais.',
    categoria: 'ensaio',
    emoji: '📸',
    conteudo: ENSAIO,
  },
  {
    slug: 'newborn',
    nome: 'Contrato — Newborn',
    descricao: 'Específico para newborn, com cláusulas de segurança e flexibilidade para o bebê.',
    categoria: 'newborn',
    emoji: '👶',
    conteudo: NEWBORN,
  },
  {
    slug: 'evento',
    nome: 'Contrato — Evento',
    descricao: 'Cobertura de eventos corporativos, aniversários, formaturas e similares.',
    categoria: 'evento',
    emoji: '🎉',
    conteudo: EVENTO,
  },
];
