# Guia Oficial do Produto Lunari

**Versão 1.0** — visão oficial do produto. Orienta toda decisão de UX, funcionalidade, prioridade e comportamento.

---

## O que é o Lunari
Ecossistema inteligente para fotógrafos. Centraliza, simplifica e automatiza todas as etapas da rotina profissional — do primeiro contato à entrega final. Conecta gestão, organização, vendas, fluxo de trabalho, galerias, financeiro, atendimento e IA em uma única plataforma.

## Missão
Eliminar a complexidade da gestão fotográfica, automatizando tarefas repetitivas para que o fotógrafo se dedique ao que gera valor: fotografar, criar, atender clientes e fazer o negócio crescer.

## Visão
Ser o ecossistema mais inteligente, completo e intuitivo para fotógrafos profissionais. Parceiro ativo do fotógrafo, não apenas uma ferramenta.

## Filosofia
Toda funcionalidade economiza tempo. Toda automação reduz esforço. Toda tela diminui decisões. O sistema trabalha para o fotógrafo, nunca o contrário.

## Público
Fotógrafos profissionais — principalmente materno-infantil, gestantes, newborn, acompanhamentos, famílias, ensaios externos, eventos, fluxo contínuo. Arquitetura permite expansão futura.

## Problema que resolvemos
Fotógrafos usam várias ferramentas separadas → perda de tempo, retrabalho, esquecimentos, duplicações, processos manuais, baixa produtividade. O Lunari centraliza tudo.

## Princípio fundamental
O fotógrafo gasta o mínimo possível administrando o negócio. Tempo economizado retorna em mais produção, melhor atendimento, maior faturamento, melhor qualidade de vida.

## Checklist obrigatório de decisão
Toda nova funcionalidade deve responder:

1. Isso economiza tempo?
2. Isso reduz cliques?
3. Isso elimina trabalho repetitivo?
4. Isso simplifica a rotina?
5. Isso reduz erros humanos?
6. Isso melhora a experiência do fotógrafo?

Maioria negativa → reavaliar. **Toda `MODULE.md` deve responder essas 6 perguntas em "Critérios do Produto".**

## O que o Lunari nunca deve ser
Complexo. Exigir treinamento para tarefas simples. Obrigar decorar processos. Depender de conhecimento técnico. Esconder informações importantes. Gerar insegurança em operações críticas.

## Inteligência Artificial
Faz parte da plataforma, não é recurso isolado. Toda funcionalidade considera uso futuro pelo Assistente.

## Papel do Assistente
**Assistente** (auxilia), **Executor** (executa ações), **Consultor** (analisa e responde), **Estrategista** (sugere melhorias).

## O que a IA nunca fará
Responder clientes automaticamente. Executar ações destrutivas sem confirmação. Ignorar regras, permissões ou validações. Inventar informações.

## Interface
Simples, limpa, rápida, consistente, previsível. Sem elementos puramente estéticos — toda peça tem finalidade clara.

## Automações
Tarefa automatizável com segurança → automatizar.

## Prioridade de funcionalidades
1. Economiza tempo. 2. Elimina trabalho manual. 3. Reduz erros. 4. Melhora organização. 5. Aumenta faturamento. 6. Recursos visuais.

## Fluxo oficial do fotógrafo
```text
Lead → Cliente → Orçamento → Contrato → Pagamento → Agenda → Sessão →
Workflow → Seleção → Entrega → Pós-venda
```

> Nota de estado atual: **Orçamento** e **Contrato** ainda não existem como módulos independentes — apenas tipos em `src/types/`. Serão promovidos a módulos próprios em ondas futuras.

Toda nova feature deve fortalecer esse fluxo, nunca fragmentá-lo.

## Gallery
Extensão natural do fluxo, não produto separado. O fotógrafo nunca sente que saiu do sistema.

## Personalização
O Lunari adapta-se ao fotógrafo, nunca o contrário. Sempre permitir personalização, configuração, preferências e automações.

## Performance
Velocidade é parte da experiência. Mesmo o complexo deve transmitir agilidade.

## Crescimento
Toda funcionalidade fortalece o ecossistema. Evitar recursos isolados.

## Qualidade
Pronto = funciona + seguro + consistente + documentado + testado + intuitivo.

## Objetivo final
O fotógrafo enxerga o Lunari como um parceiro inteligente administrando seu negócio. Sucesso = tempo, energia e preocupação removidos da rotina.
