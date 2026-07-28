---
name: Design DNA Lunari v1
description: DNA visual e de UX oficial do Lunari. Consultar ANTES de qualquer plano de UI/UX. Luxo silencioso — neutros + grafite + dourado institucional, filosofia, 3 níveis, componentes, linguagem operacional.
type: design
---

Fonte de verdade: `docs/constitution/DESIGN_DNA.md`.

Regras-núcleo (aplicar sempre):

## Identidade cromática
- Luxo silencioso. Distribuição obrigatória: **85% neutros · 12% grafite `#171717` · 3% dourado `#C6A36A`**.
- Ordem de percepção: conteúdo → dados → navegação → identidade. Se a marca aparece antes do conteúdo, a proporção está errada.
- Sidebar é **sempre grafite `#171717`**, em light e dark. Nunca acompanha o tema.
- Dourado nunca em: gradientes, efeitos metálicos, grandes áreas, foco de input, botão primário padrão, header, tabela, badge, switch, checkbox marcado, cor de série em gráfico.
- CTA dourado é reservado a: Upgrade, Comprar créditos, Solicitar demonstração, Assinatura. Fora disso é violação.
- Gráficos são monocromáticos (cinza `#6D6D6D` + preto `#171717`). Dourado só em hover pontual de ponto de linha/área.
- Cores funcionais são absolutas: sucesso `#37B26C`, erro `#D94A4A`, alerta `#D89B2C`, info `#4E88E5`. Nunca substituídas por dourado.
- Assistente IA é a **única** superfície com dourado consistente (ícone, cursor, ponto online, animações).
- Microinterações douradas = lista fechada no DNA. Qualquer uso novo exige atualizar o DNA antes do código.

## Filosofia e UX
- Interface deve desaparecer. Cada tela = painel de acompanhamento, nunca ERP/formulário.
- Referências: Linear, Notion Calendar, Raycast, Arc, Stripe Dashboard. Nunca dashboards financeiros carregados.
- Hierarquia obrigatória em 3 níveis: crítico (cliente/valor/status/ação) > contexto (pacote/data/qtd) > auxiliar (observações/ajuda).
- Componentes universais: um Card de Sessão vale para Workflow, Galeria, Financeiro, CRM. Nunca componente exclusivo de página.
- Cards: muito respiro, agrupamento por espaçamento (não por linhas), cantos suaves, `radius 20px`, sombra `0 8px 24px rgba(0,0,0,.03)`.
- Uma única ação principal por tela. Demais viram secundárias.
- Botões: Primário (preto `#171717`), Secundário (branco, borda `#D8D4CE`), CTA Premium (dourado, uso restrito). Proibido inventar variantes.
- Inputs devem desaparecer: preferir dropdown, chips, cards, seletores. Foco de input é **preto**, nunca dourado.
- Modais = painéis operacionais. Ordem: o que existe > estado > o que falta > só então edição.
- Densidade baixa. Na dúvida entre mostrar/esconder: esconder.
- Nunca repetir a mesma informação em locais diferentes.
- Cor nunca sozinha: sempre acompanhada de texto/ícone/estado. Deve funcionar em escala de cinza.
- Ícones discretos, mesmo peso visual, nunca decorativos.
- Espaço vazio é parte do layout ("menos interface do que realmente existe").
- Animações curtas, funcionais, nunca chamativas.
- Linguagem operacional: "Próxima etapa" > "Selecione uma etapa"; "Gerenciar" > "Editar"; "Em produção" > "Status". O Lunari conduz, não pergunta.
- Sensações-alvo: calma, organização, precisão, elegância, confiança, rapidez. Proibido transmitir: excesso, aparência técnica, cara de admin.

## Débito de implementação (não é DNA, é backlog)
`src/index.css`, `src/styles/lunari-design-rules.md`, `tailwind.config.ts`, `src/lib/visualTheme.ts` e componentes com cor hardcoded ainda usam a paleta terracota antiga. Migração vem em ondas separadas — o DNA já é a fonte de verdade.
