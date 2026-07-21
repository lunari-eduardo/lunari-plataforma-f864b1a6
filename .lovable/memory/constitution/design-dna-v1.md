---
name: Design DNA Lunari v1
description: DNA visual e de UX oficial do Lunari. Consultar ANTES de qualquer plano de UI/UX. Filosofia, hierarquia de 3 níveis, cards, botões, modais, densidade, linguagem operacional.
type: design
---

Fonte de verdade: `docs/constitution/DESIGN_DNA.md`.

Regras-núcleo (aplicar sempre):

- Interface deve desaparecer. Cada tela = painel de acompanhamento, nunca ERP/formulário.
- Referências: Linear, Notion Calendar, Raycast, Arc, Stripe Dashboard. Nunca dashboards financeiros carregados.
- Hierarquia obrigatória em 3 níveis: crítico (cliente/valor/status/ação) > contexto (pacote/data/qtd) > auxiliar (observações/ajuda).
- Componentes universais: um Card de Sessão vale para Workflow, Galeria, Financeiro, CRM. Nunca componente exclusivo de página.
- Cards: muito respiro, agrupamento por espaçamento (não por linhas), cantos suaves.
- Uma única ação principal por tela. Demais viram secundárias.
- Botões: apenas Primário, Secundário, Terciário. Proibido inventar variantes novas.
- Inputs devem desaparecer: preferir dropdown, chips, cards, seletores em vez de campos.
- Modais = painéis operacionais. Ordem: o que existe > estado > o que falta > só então edição.
- Densidade baixa. Na dúvida entre mostrar/esconder: esconder.
- Nunca repetir a mesma informação em locais diferentes.
- Cor nunca sozinha: sempre acompanhada de texto/ícone/estado. Deve funcionar em escala de cinza.
- Ícones discretos, mesmo peso visual, nunca decorativos.
- Espaço vazio é parte do layout ("menos interface do que realmente existe").
- Animações curtas, funcionais, nunca chamativas.
- Linguagem operacional: "Próxima etapa" > "Selecione uma etapa"; "Gerenciar" > "Editar"; "Em produção" > "Status". O Lunari conduz, não pergunta.
- Sensações-alvo: calma, organização, precisão, elegância, confiança, rapidez. Proibido transmitir: excesso, aparência técnica, cara de admin.
