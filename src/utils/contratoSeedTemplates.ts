/**
 * Modelos de contrato profissionais prontos para uso.
 * Cobrem os principais segmentos da fotografia: ensaio, gestante, casamento, newborn e evento.
 *
 * Padrão de variáveis (todas em snake_case):
 *  Cliente: {{nome_cliente}}, {{cpf_cliente}}, {{rg_cliente}}, {{documento_cliente}},
 *           {{cidade_cliente}}, {{estado_cliente}}, {{email_cliente}}, {{nome_bebe}}
 *  Fotógrafo: {{nome_fotografo}}, {{documento_fotografo}}, {{cidade_fotografo}}, {{email_fotografo}}
 *  Sessão/Evento: {{tipo_ensaio}}, {{tipo_evento}}, {{data_sessao}}, {{data_evento}},
 *                 {{horario_inicio}}, {{horario_termino}}, {{duracao_sessao}}, {{duracao_maxima}},
 *                 {{local_ensaio}}, {{local_evento}}
 *  Comerciais: {{valor_total}}, {{valor_sinal}}, {{valor_hora_extra}}, {{valor_foto_extra}},
 *              {{taxa_deslocamento}}, {{valor_taxa_dano}}, {{forma_pagamento}},
 *              {{descricao_forma_pagamento}}, {{quantidade_fotos}}, {{prazo_entrega}},
 *              {{prazo_entrega_final}}, {{prazo_selecao}}, {{dias_aviso_previo}},
 *              {{dias_multa_cancelamento}}, {{porcentagem_multa}}, {{fornecimento_figurino}}
 */

export interface ContratoSeedTemplate {
  slug: 'ensaio' | 'gestante' | 'casamento' | 'newborn' | 'evento';
  nome: string;
  descricao: string;
  categoria: string;
  emoji: string;
  conteudo: string;
}

const ENSAIO = `<h2>Contrato de Prestação de Serviços Fotográficos</h2>

<h3>1. Qualificação das partes</h3>
<p><strong>CONTRATANTE:</strong> {{nome_cliente}}, inscrito(a) no CPF/CNPJ sob o nº {{documento_cliente}}, residente/sediado(a) na cidade de {{cidade_cliente}}, {{estado_cliente}}, com e-mail: {{email_cliente}}.</p>
<p><strong>CONTRATADA(O):</strong> {{nome_fotografo}}, inscrito(a) no CPF/CNPJ sob o nº {{documento_fotografo}}, sediado(a) na cidade de {{cidade_fotografo}}, com e-mail: {{email_fotografo}}.</p>

<h3>2. Do objeto e da data</h3>
<p>O presente instrumento tem como objeto a prestação de serviços fotográficos referentes a um Ensaio <strong>{{tipo_ensaio}}</strong>.</p>
<p><strong>Data da Sessão:</strong> {{data_sessao}}<br/>
<strong>Horário de Início:</strong> {{horario_inicio}} (a tolerância de atraso é de 15 minutos; o tempo de atraso será descontado da duração total do ensaio).<br/>
<strong>Duração do Ensaio:</strong> {{duracao_sessao}} horas.</p>

<h3>3. Das locações e deslocamento (estúdio e externas)</h3>
<p><strong>Ensaios externos/terceiros:</strong> caso o local escolhido exija pagamento de taxas de locação ou autorizações prévias, os custos e trâmites são de inteira responsabilidade da(o) CONTRATANTE. Taxas de deslocamento fora do perímetro urbano da cidade sede da(o) CONTRATADA(O) serão cobradas no valor de <strong>{{taxa_deslocamento}}</strong>.</p>
<p><strong>Uso do estúdio/cenários próprios:</strong> em ensaios realizados nas instalações da(o) CONTRATADA(O), a(o) CONTRATANTE compromete-se a zelar pelo espaço. Danos a fundos fotográficos, plantas ou estruturas causados por mau uso ou negligência estarão sujeitos a taxa de reparo.</p>

<h3>4. Das condições climáticas e reagendamento</h3>
<p>Para ensaios externos, em caso de previsão de chuva ou condições que inviabilizem tecnicamente as fotos, o ensaio será reagendado para a próxima data disponível de comum acordo, sem custos adicionais.</p>
<p>O reagendamento por motivos pessoais da(o) CONTRATANTE deve ser solicitado com no mínimo <strong>{{dias_aviso_previo}}</strong> dias de antecedência, sendo permitido apenas 1 (um) reagendamento gratuito.</p>

<h3>5. Dos serviços inclusos e entregáveis</h3>
<p>A(o) CONTRATANTE receberá uma galeria para seleção no sistema em até <strong>{{prazo_selecao}}</strong> dias úteis após a sessão.</p>
<p>O pacote contratado dá direito a <strong>{{quantidade_fotos}}</strong> fotografias tratadas em alta resolução. Fotos extras escolhidas no sistema terão o custo de <strong>{{valor_foto_extra}}</strong> por unidade.</p>
<p>O prazo de entrega do material final editado é de até <strong>{{prazo_entrega_final}}</strong> dias úteis após a seleção final feita pela(o) CONTRATANTE. Não serão entregues arquivos brutos (RAW).</p>

<h3>6. Do valor e forma de pagamento</h3>
<p>O investimento total para este ensaio é de <strong>{{valor_total}}</strong>, pago através de <strong>{{forma_pagamento}}</strong>. A reserva de data e horário está condicionada à assinatura deste contrato e ao pagamento do sinal/arras de <strong>{{valor_sinal}}</strong>.</p>

<h3>7. Dos direitos autorais e uso de imagem</h3>
<p>A autoria das imagens pertence à(ao) CONTRATADA(O) (Lei nº 9.610/98), sendo expressamente vedada à(ao) CONTRATANTE a aplicação de filtros predefinidos ou a reedição das imagens finalizadas.</p>
<p>A(O) CONTRATANTE autoriza a utilização de parte das imagens resultantes do ensaio para composição de portfólio, site e redes sociais da(o) CONTRATADA(O).</p>

<h3>8. Do foro</h3>
<p>Elegem as partes o foro da comarca de <strong>{{cidade_fotografo}}</strong> para dirimir eventuais litígios oriundos deste contrato.</p>`;

const GESTANTE = `<h2>Contrato de Prestação de Serviços Fotográficos – Ensaio Gestante</h2>

<h3>1. Qualificação das partes</h3>
<p><strong>CONTRATANTE:</strong> {{nome_cliente}}, inscrito(a) no CPF sob o nº {{cpf_cliente}}, residente e domiciliado(a) na cidade de {{cidade_cliente}}, {{estado_cliente}}, com e-mail: {{email_cliente}}.</p>
<p><strong>CONTRATADA(O):</strong> {{nome_fotografo}}, inscrito(a) no CPF/CNPJ sob o nº {{documento_fotografo}}, sediado(a) na cidade de {{cidade_fotografo}}, com e-mail: {{email_fotografo}}.</p>

<h3>2. Do objeto</h3>
<p>O presente instrumento tem como objeto a prestação de serviços fotográficos referentes ao ensaio de <strong>GESTANTE</strong>, a ser realizado na data de <strong>{{data_sessao}}</strong>, com duração aproximada de <strong>{{duracao_sessao}}</strong> horas.</p>

<h3>3. Do figurino, maquiagem e preparação</h3>
<p><strong>Figurino:</strong> a locação ou disponibilização de roupas e vestidos {{fornecimento_figurino}}.</p>
<p><strong>Danos ao acervo:</strong> caso a(o) CONTRATANTE utilize peças do acervo da(o) CONTRATADA(O) e estas sofram danos permanentes (rasgos, manchas irreversíveis de barro/terra, etc.), será cobrada uma taxa de manutenção no valor de <strong>{{valor_taxa_dano}}</strong>.</p>
<p><strong>Maquiagem e cabelo:</strong> a produção de cabelo e maquiagem não está inclusa no valor deste contrato, devendo a(o) CONTRATANTE chegar ao local do ensaio já produzida.</p>

<h3>4. Da saúde, segurança e limitações físicas</h3>
<p>A integridade e o bem-estar da gestante são prioridade absoluta. A(O) CONTRATADA(O) se compromete a realizar pausas para descanso e hidratação sempre que solicitado.</p>
<p>Em ensaios realizados em áreas externas, matas ou jardins, a(o) CONTRATANTE declara ciência das condições naturais do terreno (solo irregular, insetos, calor/frio), assumindo a responsabilidade por transitar com calçados adequados e seguros entre os cenários.</p>

<h3>5. Das condições climáticas (para ensaios externos)</h3>
<p>O ensaio depende de condições climáticas favoráveis para garantir a estética e a segurança. Em caso de previsão de chuva, ventos fortes ou condições extremas na véspera ou no dia agendado, a(o) CONTRATADA(O) reserva-se o direito de sugerir o reagendamento para a próxima data disponível, sem custos adicionais.</p>
<p>Dias nublados não configuram mau tempo e não são justificativa para reagendamento por parte da(o) CONTRATANTE.</p>

<h3>6. Dos serviços inclusos e entregáveis</h3>
<p>O material final, composto por <strong>{{quantidade_fotos}}</strong> fotografias tratadas em alta resolução, será disponibilizado através de galeria digital em até <strong>{{prazo_entrega}}</strong> dias úteis após a seleção das imagens.</p>
<p>A edição inclui ajustes de cor, contraste e limpeza básica de pele. Manipulações avançadas (alteração corporal, troca de fundos ou remoção de elementos complexos) não estão inclusas e, se solicitadas, serão orçadas à parte.</p>

<h3>7. Do valor e forma de pagamento</h3>
<p>Pela prestação dos serviços, a(o) CONTRATANTE pagará o valor total de <strong>{{valor_total}}</strong>, a ser quitado mediante <strong>{{forma_pagamento}}</strong>. A reserva da data só se confirma após o pagamento do sinal de <strong>{{valor_sinal}}</strong>.</p>

<h3>8. Do cancelamento, reagendamento e imprevistos médicos</h3>
<p>Cancelamentos por motivos pessoais (não médicos) retêm o valor do sinal para cobrir bloqueio de agenda.</p>
<p><strong>Nascimento prematuro/repouso médico:</strong> caso o bebê nasça antes da data do ensaio, ou haja prescrição médica de repouso absoluto, o valor pago poderá ser integralmente revertido em crédito para um ensaio Newborn ou Lifestyle do bebê, sujeito aos ajustes de valores do novo pacote escolhido.</p>

<h3>9. Direitos autorais e foro</h3>
<p>A(O) CONTRATANTE autoriza o uso das imagens para portfólio e redes sociais da(o) CONTRATADA(O). A autoria das imagens é da(o) CONTRATADA(O) (Lei nº 9.610/98), sendo vedada a aplicação de filtros por terceiros.</p>
<p>Fica eleito o foro da comarca de <strong>{{cidade_fotografo}}</strong> para dirimir eventuais dúvidas.</p>`;

const CASAMENTO = `<h2>Contrato de Prestação de Serviços Fotográficos – Casamento</h2>

<h3>1. Qualificação das partes</h3>
<p><strong>CONTRATANTE:</strong> {{nome_cliente}}, inscrito(a) no CPF sob o nº {{cpf_cliente}} e RG nº {{rg_cliente}}, residente e domiciliado(a) na cidade de {{cidade_cliente}}, {{estado_cliente}}, com e-mail: {{email_cliente}}.</p>
<p><strong>CONTRATADA(O):</strong> {{nome_fotografo}}, inscrito(a) no CPF/CNPJ sob o nº {{documento_fotografo}}, sediado(a) na cidade de {{cidade_fotografo}}, com e-mail: {{email_fotografo}}.</p>

<h3>2. Do objeto e da data</h3>
<p>O presente instrumento tem como objeto a prestação de serviços de cobertura fotográfica do evento de <strong>CASAMENTO</strong>, a ser realizado na data de <strong>{{data_evento}}</strong>.</p>
<p><strong>Horário de Início:</strong> {{horario_inicio}}<br/>
<strong>Horário de Término (cobertura máxima):</strong> {{horario_termino}}</p>

<h3>3. Dos serviços inclusos e entregáveis</h3>
<p>A cobertura fotográfica será realizada conforme o pacote contratado, que compreende:</p>
<ul>
  <li>Captação de imagens durante o período estabelecido na Cláusula 2. Horas adicionais solicitadas no dia do evento serão cobradas no valor de <strong>{{valor_hora_extra}}</strong> por hora.</li>
  <li>Tratamento e edição das imagens (ajustes de cor, contraste e enquadramento), mantendo o estilo autoral da(o) CONTRATADA(O).</li>
  <li><strong>Prazo e formato:</strong> o material final composto por <strong>{{quantidade_fotos}}</strong> fotos em alta resolução será entregue em formato estritamente digital no prazo máximo de <strong>{{prazo_entrega}}</strong> dias úteis após a realização do evento, através de galeria online para visualização e download.</li>
</ul>

<h3>4. Do valor e forma de pagamento</h3>
<p>Pelos serviços prestados, a(o) CONTRATANTE pagará o valor total de <strong>{{valor_total}}</strong>, a ser quitado da seguinte forma:</p>
<p>{{descricao_forma_pagamento}}</p>
<p>A reserva da data e bloqueio da agenda da(o) CONTRATADA(O) só se confirmam após a assinatura deste instrumento e compensação do pagamento do sinal.</p>

<h3>5. Deveres e condições de execução</h3>
<p><strong>Alimentação:</strong> a(o) CONTRATANTE compromete-se a fornecer alimentação adequada (jantar/buffet) à equipe de fotografia durante a realização do evento, no mesmo local dos convidados ou em área reservada pelo cerimonial.</p>
<p><strong>Interferências:</strong> a(o) CONTRATADA(O) não se responsabiliza por fotos não realizadas devido a atrasos dos noivos, restrições impostas pelas igrejas/locais do evento ou interferência de convidados portando câmeras e celulares na frente da equipe.</p>

<h3>6. Do cancelamento e reagendamento</h3>
<p>Em caso de cancelamento por parte da(o) CONTRATANTE, o valor pago a título de sinal (arras) não será reembolsado, destinado a cobrir os custos de reserva de data.</p>
<p>Se o cancelamento ocorrer a menos de 30 dias do evento, incidirá multa correspondente a 50% do valor total do contrato.</p>
<p>O reagendamento de datas está sujeito à disponibilidade da agenda da(o) CONTRATADA(O) e poderá sofrer reajuste de valores correspondentes ao novo ano/tabela.</p>

<h3>7. Dos direitos autorais e uso de imagem</h3>
<p>A(O) CONTRATANTE autoriza, de forma gratuita, o uso das imagens resultantes deste contrato para fins de composição de portfólio, participação em concursos, publicações em site institucional e redes sociais da(o) CONTRATADA(O), em conformidade com a Lei Geral de Proteção de Dados (LGPD).</p>
<p>A autoria das imagens pertence à(ao) CONTRATADA(O) (Lei nº 9.610/98). É vedado à(ao) CONTRATANTE aplicar filtros ou alterar a edição original das fotografias entregues.</p>

<h3>8. Do foro</h3>
<p>Para dirimir quaisquer controvérsias oriundas deste contrato, as partes elegem o foro da comarca de <strong>{{cidade_fotografo}}</strong>, renunciando a qualquer outro por mais privilegiado que seja.</p>`;

const NEWBORN = `<h2>Contrato de Prestação de Serviços Fotográficos – Ensaio Newborn</h2>

<h3>1. Qualificação das partes</h3>
<p><strong>CONTRATANTE (Pais/Responsáveis):</strong> {{nome_cliente}}, inscrito(a) no CPF sob o nº {{cpf_cliente}}, residente e domiciliado(a) na cidade de {{cidade_cliente}}, {{estado_cliente}}, com e-mail: {{email_cliente}}.</p>
<p><strong>CONTRATADA(O) (Estúdio/Fotógrafo):</strong> {{nome_fotografo}}, inscrito(a) no CPF/CNPJ sob o nº {{documento_fotografo}}, sediado(a) na cidade de {{cidade_fotografo}}, com e-mail: {{email_fotografo}}.</p>

<h3>2. Do objeto</h3>
<p>O presente instrumento tem como objeto a prestação de serviços fotográficos referentes ao ensaio da categoria <strong>Newborn</strong> (recém-nascido) do bebê <strong>{{nome_bebe}}</strong>, a ser realizado na data de <strong>{{data_sessao}}</strong>.</p>

<h3>3. Da dinâmica e duração do ensaio</h3>
<p>O ensaio Newborn respeita única e exclusivamente o tempo, o conforto e os reflexos do bebê (ciclos de sono, amamentação e necessidades fisiológicas).</p>
<p>A sessão terá duração máxima de <strong>{{duracao_maxima}}</strong> horas. Caso o bebê não atinja o estado de relaxamento necessário neste período, a(o) CONTRATADA(O) reserva-se o direito de encerrar a sessão, entregando o material possível ou, a seu critério, agendando um retorno.</p>

<h3>4. Da saúde, segurança e higiene (cláusula vital)</h3>
<p><strong>Segurança em 1º lugar:</strong> a(o) CONTRATADA(O) conduzirá o ensaio priorizando a segurança física e o conforto térmico do recém-nascido. A(O) fotógrafa(o) reserva-se o direito incontestável de interromper, recusar ou não realizar qualquer pose que julgue oferecer o mínimo risco à integridade do bebê.</p>
<p><strong>Supervisão:</strong> é obrigatória a presença contínua e a supervisão ativa de pelo menos um dos pais ou responsáveis legais durante 100% do tempo de realização do ensaio. A(O) CONTRATADA(O) não se responsabiliza por incidentes decorrentes da ausência dos pais no ambiente do set.</p>
<p><strong>Higiene e saúde:</strong> o estúdio e os adereços (props, mantas e roupinhas) são previamente higienizados. Caso o bebê, os pais ou a equipe fotográfica apresentem qualquer sintoma viral ou infeccioso nas 24 horas que antecedem o ensaio, a sessão deverá ser obrigatoriamente reagendada.</p>

<h3>5. Dos serviços inclusos e entregáveis</h3>
<p>O material final, composto por <strong>{{quantidade_fotos}}</strong> fotografias tratadas em alta resolução, será disponibilizado através de galeria digital segura em até <strong>{{prazo_entrega}}</strong> dias úteis após o ensaio ou após a seleção das imagens por parte da(o) CONTRATANTE.</p>
<p>Não serão entregues, em hipótese alguma, arquivos brutos (RAW) ou fotografias sem edição.</p>

<h3>6. Do valor e forma de pagamento</h3>
<p>Pela prestação dos serviços, a(o) CONTRATANTE pagará o valor total de <strong>{{valor_total}}</strong>, a ser quitado mediante <strong>{{forma_pagamento}}</strong>. A reserva de agenda só se efetiva após a assinatura deste contrato e confirmação do pagamento do sinal de garantia.</p>

<h3>7. Do cancelamento e reagendamento</h3>
<p>Compreendendo a natureza imprevisível dos primeiros dias de vida, é permitido um reagendamento sem custos, desde que comunicado com antecedência.</p>
<p>O não comparecimento no horário agendado sem aviso prévio (no-show) implicará no cancelamento do ensaio e retenção do sinal pago, para cobrir os custos de preparação e bloqueio de agenda.</p>

<h3>8. Dos direitos autorais e uso de imagem</h3>
<p>A autoria das imagens é resguardada à(ao) CONTRATADA(O) (Lei nº 9.610/98), sendo vedada a aplicação de filtros ou edições por terceiros.</p>
<p>A(O) CONTRATANTE autoriza o uso das imagens do ensaio para fins de composição de portfólio profissional, participação em prêmios de fotografia newborn e publicações nas redes sociais da(o) CONTRATADA(O).</p>

<h3>9. Do foro</h3>
<p>Fica eleito o foro da comarca de <strong>{{cidade_fotografo}}</strong> para dirimir eventuais dúvidas ou controvérsias oriundas deste contrato.</p>`;

const EVENTO = `<h2>Contrato de Prestação de Serviços Fotográficos – Evento</h2>

<h3>1. Qualificação das partes</h3>
<p><strong>CONTRATANTE:</strong> {{nome_cliente}}, inscrito(a) no CPF/CNPJ sob o nº {{documento_cliente}}, residente/sediado(a) na cidade de {{cidade_cliente}}, {{estado_cliente}}, com e-mail: {{email_cliente}}.</p>
<p><strong>CONTRATADA(O):</strong> {{nome_fotografo}}, inscrito(a) no CPF/CNPJ sob o nº {{documento_fotografo}}, sediado(a) na cidade de {{cidade_fotografo}}, com e-mail: {{email_fotografo}}.</p>

<h3>2. Do objeto e da data</h3>
<p>O presente instrumento tem como objeto a prestação de serviços de cobertura fotográfica do evento do tipo <strong>{{tipo_evento}}</strong>, a ser realizado na data de <strong>{{data_evento}}</strong>.</p>
<p><strong>Horário de Início:</strong> {{horario_inicio}}<br/>
<strong>Horário de Término:</strong> {{horario_termino}}</p>

<h3>3. Dos serviços inclusos e entregáveis</h3>
<p>A cobertura fotográfica será realizada conforme o escopo contratado, compreendendo:</p>
<ul>
  <li>Captação de imagens durante o período estabelecido na Cláusula 2. Horas adicionais solicitadas no dia do evento serão cobradas no valor de <strong>{{valor_hora_extra}}</strong> por hora.</li>
  <li>Tratamento e edição das imagens (ajustes de cor, contraste e enquadramento), mantendo a identidade visual e o estilo autoral da(o) CONTRATADA(O).</li>
  <li><strong>Prazo e formato:</strong> o material final, composto por <strong>{{quantidade_fotos}}</strong> fotos em alta resolução, será entregue em formato digital no prazo máximo de <strong>{{prazo_entrega}}</strong> dias úteis após a realização do evento, através de plataforma online para visualização e download.</li>
</ul>

<h3>4. Do valor e forma de pagamento</h3>
<p>Pelos serviços prestados, a(o) CONTRATANTE pagará o valor total de <strong>{{valor_total}}</strong>, a ser quitado da seguinte forma:</p>
<p>{{descricao_forma_pagamento}}</p>
<p>A reserva da data na agenda da(o) CONTRATADA(O) apenas se confirma após a assinatura deste instrumento e a compensação do sinal financeiro (quando aplicável).</p>

<h3>5. Deveres e condições de execução</h3>
<p><strong>Alimentação:</strong> em eventos com duração contínua igual ou superior a 4 (quatro) horas, a(o) CONTRATANTE compromete-se a fornecer alimentação adequada à equipe de fotografia no próprio local.</p>
<p><strong>Interferências e normas do local:</strong> a(o) CONTRATADA(O) não se responsabiliza por restrições fotográficas impostas pela administração do local do evento, falhas na iluminação do ambiente ou atrasos no cronograma oficial que reduzam o tempo hábil para os registros.</p>

<h3>6. Do cancelamento e reagendamento</h3>
<p>Em caso de cancelamento por parte da(o) CONTRATANTE, o valor pago a título de reserva de data (sinal) não será reembolsado.</p>
<p>Cancelamentos realizados a menos de <strong>{{dias_multa_cancelamento}}</strong> dias do evento implicarão em multa de <strong>{{porcentagem_multa}}%</strong> sobre o valor total do contrato.</p>
<p>O reagendamento está sujeito à disponibilidade na agenda da(o) CONTRATADA(O) e a possíveis reajustes tarifários da nova data.</p>

<h3>7. Dos direitos autorais e uso de imagem</h3>
<p>A autoria das imagens pertence legalmente à(ao) CONTRATADA(O) (Lei nº 9.610/98). É expressamente vedado à(ao) CONTRATANTE aplicar filtros ou alterar a edição original das fotografias.</p>
<p><strong>Para eventos sociais (pessoas físicas):</strong> o uso das imagens pela(o) CONTRATANTE é estritamente pessoal. A(o) CONTRATANTE autoriza o uso das imagens no portfólio e redes sociais da(o) CONTRATADA(O), salvo manifestação contrária.</p>
<p><strong>Para eventos corporativos (pessoas jurídicas):</strong> a(o) CONTRATADA(O) cede à(ao) CONTRATANTE o direito de uso institucional e comercial das imagens, restrito à promoção da própria marca, sendo vedada a revenda do material para bancos de imagens de terceiros.</p>

<h3>8. Do foro</h3>
<p>Para dirimir quaisquer controvérsias oriundas deste contrato, as partes elegem o foro da comarca de <strong>{{cidade_fotografo}}</strong>, renunciando a qualquer outro.</p>`;

export const CONTRATO_SEED_TEMPLATES: ContratoSeedTemplate[] = [
  {
    slug: 'ensaio',
    nome: 'Contrato — Ensaio Fotográfico',
    descricao: 'Modelo profissional para ensaios em estúdio ou externos. Inclui cláusulas de deslocamento, clima e fotos extras.',
    categoria: 'ensaio',
    emoji: '📸',
    conteudo: ENSAIO,
  },
  {
    slug: 'gestante',
    nome: 'Contrato — Ensaio Gestante',
    descricao: 'Específico para gestantes, com cláusulas de saúde, figurino, segurança e nascimento prematuro.',
    categoria: 'gestante',
    emoji: '🤰',
    conteudo: GESTANTE,
  },
  {
    slug: 'casamento',
    nome: 'Contrato — Casamento',
    descricao: 'Cobertura completa de casamento com sinal, multa de cancelamento, alimentação da equipe e LGPD.',
    categoria: 'casamento',
    emoji: '💍',
    conteudo: CASAMENTO,
  },
  {
    slug: 'newborn',
    nome: 'Contrato — Newborn',
    descricao: 'Específico para newborn, com cláusula vital de segurança, higiene e supervisão dos pais.',
    categoria: 'newborn',
    emoji: '👶',
    conteudo: NEWBORN,
  },
  {
    slug: 'evento',
    nome: 'Contrato — Eventos',
    descricao: 'Eventos corporativos, festas infantis, aniversários e formaturas. Inclui cláusulas para PJ e PF.',
    categoria: 'evento',
    emoji: '🎉',
    conteudo: EVENTO,
  },
];
