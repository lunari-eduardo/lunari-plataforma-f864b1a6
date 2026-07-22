# Plano Oficial — Unificação Gradual Gallery → Studio (v2)

> Substitui integralmente qualquer plano anterior de "big bang".
> Última revisão: 2026-07-22.

## Objetivo Final (inalterado)

Existir apenas **um** projeto Lunari:
- um deploy,
- uma arquitetura,
- uma autenticação,
- um domínio principal,
- um sistema de permissões,
- uma única fonte de regras de negócio.

O projeto **Gallery deixará de existir** no futuro. O que mudou é *quando* e *como*.

## Mudança de estratégia

Em vez de parar tudo por ~2 meses para fazer uma fusão em bloco, a prioridade passa a ser:

1. Finalizar todas as funcionalidades do **Studio**.
2. Finalizar todas as funcionalidades do **Gallery**.
3. Estabilizar completamente ambos.
4. Iniciar o **beta fechado**.
5. Validar o produto com usuários reais.
6. **Só depois** iniciar a migração.

Arquitetura ideal continua importante, mas **tempo de mercado > arquitetura perfeita** neste momento.

## Princípio durante o beta

Gallery entra em **modo manutenção**:

- ✅ Continua sendo usado normalmente por fotógrafos e clientes finais.
- ✅ Continua processando pagamentos e entregando galerias.
- ❌ Não recebe novas funcionalidades relevantes.
- ✅ Recebe apenas correções de bugs e ajustes críticos.

Todo desenvolvimento novo é pensado para a **arquitetura unificada futura**.

## Nova arquitetura de navegação

Ao invés de um item "Gallery" na sidebar do Studio, a navegação será por **Workspaces**, com um seletor no topo:

```
Studio ▼
 ├─ Studio
 └─ Gallery
```

Ao trocar de Workspace mudam sidebar, dashboard, menus, atalhos e interface — mas **permanecem** a mesma sessão, login, domínio, banco e permissões.

Sensação para o fotógrafo: trocar de ambiente **dentro** do Lunari, não abrir outro sistema. Este é o comportamento definitivo.

## Identidade visual

- **Studio (fotógrafo):** identidade única Lunari.
- **Gallery (fotógrafo):** identidade única Lunari.
- **Cliente Final (`/g/:token`):** tema personalizado por galeria — única exceção.

## Domínios

- `app.lunarihub.com` — ambiente principal (fotógrafo + admin).
- `gallery.lunarihub.com` — **mantido** para o cliente final, mesmo após unificação.
  - Motivos: links já enviados, SEO, experiência, branding.
  - Internamente aponta para o mesmo projeto.

## Módulos compartilhados (fonte única de verdade)

Depois da unificação, **Gallery consome os módulos do Studio** — nunca duplica:

- **Clientes:** CRM do Studio é a única fonte. Gallery apenas lê/referencia.
- **Financeiro:** pagamentos, extras, histórico, cobranças, PIX, Asaas, Mercado Pago, InfinitePay — tudo pelos módulos do Studio.
- **Configurações:** meios de pagamento, integrações, branding, empresa — configurados **uma única vez** no Studio.

## Estratégia de migração — incremental, não "big bang"

```text
Gallery atual
      ↓
Estabilização
      ↓
Beta fechado
      ↓
Correções
      ↓
Construção do módulo Gallery dentro do Studio (atrás de flag)
      ↓
Feature Flag → Admin
      ↓
Primeiros usuários
      ↓
Grupo Beta
      ↓
Todos usuários
      ↓
Projeto Gallery em Read Only
      ↓
Arquivamento definitivo
```

## Feature Flags — obrigatório

Toda implementação nova nasce **protegida por flag**, permitindo:

- testar apenas com administradores;
- liberar para poucos fotógrafos;
- rollback imediato;
- migração gradual.

Nunca troca completa em uma única virada.

## Regras enquanto Gallery existir separado

**Permitido:** criar galerias, entregar galerias, selecionar fotos, cobrar extras, uso normal.

**Evitar** (impacto cross-projeto):
- alterar contratos compartilhados;
- alterar autenticação;
- alterar webhooks compartilhados;
- alterar tabelas compartilhadas;
- alterar storage compartilhado;
- criar fluxos novos que exijam os dois projetos conversando entre si.

Se uma alteração estrutural for **realmente** necessária, já projetá-la considerando a arquitetura unificada futura.

## Cronograma

Sem prazo fixo. A unificação inicia quando os **três critérios** forem atendidos:

1. Studio completamente estabilizado.
2. Gallery completamente estabilizado.
3. Beta validado com usuários reais.

## Referência para a IA

Quando a unificação começar, este documento é a **referência principal**. A migração deverá:

- preservar compatibilidade com usuários ativos;
- evitar interrupções;
- evitar congelamento da plataforma;
- permitir rollback em qualquer etapa;
- migrar gradualmente;
- reutilizar ao máximo os módulos existentes do Studio.

**Arquitetura final:** um único projeto.
**Estratégia oficial:** migração gradual, incremental e orientada por estabilidade.
