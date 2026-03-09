-- Update Casamento template to include endereço da cerimônia e festa
UPDATE formulario_templates 
SET campos = '[
  {"id":"c1","tipo":"texto_curto","label":"Nome dos noivos","placeholder":"Ex: Ana e Pedro","ordem":1,"obrigatorio":true},
  {"id":"c2","tipo":"texto_curto","label":"Endereço da cerimônia","placeholder":"Ex: Igreja São José, Rua das Flores 123","ordem":2,"obrigatorio":true,"descricao":"Local completo com endereço"},
  {"id":"c3","tipo":"texto_curto","label":"Endereço da festa","placeholder":"Ex: Espaço Verde, Av. Central 456","ordem":3,"obrigatorio":false,"descricao":"Deixe em branco se for no mesmo local da cerimônia"},
  {"id":"c4","tipo":"texto_curto","label":"Música de entrada","placeholder":"Ex: Perfect - Ed Sheeran","ordem":4,"obrigatorio":false},
  {"id":"c5","tipo":"texto_longo","label":"Pessoas importantes","placeholder":"Ex: avó Tereza (95 anos, só pode no início), padrinho João...","ordem":5,"obrigatorio":true,"descricao":"Anote especialmente pessoas com horários especiais"},
  {"id":"c6","tipo":"texto_longo","label":"Momentos obrigatórios","placeholder":"Ex: primeira dança, entrada dos pais, discurso do padrinho...","ordem":6,"obrigatorio":true,"descricao":"Liste tudo que é essencial para vocês"},
  {"id":"c7","tipo":"texto_longo","label":"Cronograma","placeholder":"Ex: 16h cerimônia, 17h coquetel, 19h jantar, 20h festa...","ordem":7,"obrigatorio":false,"descricao":"Nos ajuda a organizar nossa presença"},
  {"id":"c8","tipo":"upload_referencia","label":"Referências de fotos","ordem":8,"obrigatorio":false},
  {"id":"c9","tipo":"texto_longo","label":"Observações finais","placeholder":"Qualquer detalhe que queiram que saibamos...","ordem":9,"obrigatorio":false}
]'::jsonb,
updated_at = now()
WHERE is_system = true AND categoria = 'casamento';

-- Also update Gestante template to match user's exact field list
UPDATE formulario_templates
SET campos = '[
  {"id":"g1","tipo":"data","label":"Data prevista do parto","ordem":1,"obrigatorio":true,"descricao":"Nos ajuda a planejar o timing ideal do ensaio"},
  {"id":"g2","tipo":"texto_curto","label":"Nome do bebê","placeholder":"Ex: Sofia","ordem":2,"obrigatorio":false,"descricao":"Pode ser deixado em branco se ainda não foi escolhido"},
  {"id":"g3","tipo":"texto_curto","label":"Cor preferida","placeholder":"Ex: tons terrosos, azul e branco, rosa e nude","ordem":3,"obrigatorio":false,"descricao":"Ajuda na escolha de acessórios e cenários"},
  {"id":"g4","tipo":"upload_referencia","label":"Referências de fotos","ordem":4,"obrigatorio":false,"descricao":"Mostre o estilo que você ama!"},
  {"id":"g5","tipo":"selecao_unica","label":"Tipo de ensaio desejado","ordem":5,"obrigatorio":true,"opcoes":["Estúdio (ambiente controlado)","Lifestyle (naturalidade)","Externo (ao ar livre)","Mix de estilos"]},
  {"id":"g6","tipo":"selecao_unica","label":"Quer fotos com família?","ordem":6,"obrigatorio":true,"opcoes":["Sim, com parceiro(a)","Sim, com parceiro(a) e filhos","Sim, toda a família","Não, apenas eu"]},
  {"id":"g7","tipo":"texto_curto","label":"Música que gosta","placeholder":"Ex: Perfect - Ed Sheeran","ordem":7,"obrigatorio":false,"descricao":"Uma curiosidade especial para lembrarmos junto com vocês"}
]'::jsonb,
updated_at = now()
WHERE is_system = true AND categoria = 'gestante';
