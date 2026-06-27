# Arquitetura Oficial do Lunari

**Versão 1.0** — define a arquitetura oficial. Em conflito técnico, prevalece sobre demais documentos de implementação. Para detalhes de implementação (Capability manifest, Ports, transporte remoto, scaffold), ver `docs/ARCHITECTURE_TECHNICAL.md`.

---

## Objetivos permanentes
1. **Escalabilidade** — crescimento sem reescrita.
2. **Reutilização** — Interface, APIs, Assistente, Mobile usam a mesma lógica.
3. **Baixo acoplamento** — mínimo de dependências entre módulos.
4. **Alta coesão** — cada módulo tem responsabilidade clara.
5. **Evolução contínua** — incorporar novas tecnologias sem reconstruir.

## Organização geral
O Lunari é organizado por módulos de domínio: CRM, Agenda, Workflow, Financeiro, Gallery, Tarefas, Configurações, Relatórios, Suporte, Administração. Cada módulo é independente.

**Padrão de localização:** `src/modules/<modulo>/`. Casos legados em `src/features/` devem ser migrados.

## Estrutura oficial por módulo
```text
domain/          entidades, value-objects, regras puras, erros
application/     commands, queries, capabilities, policies, validators, events
ports/           interfaces de I/O do módulo (repos, clock, notifier…)
infrastructure/  implementações (Supabase, R2, pagamentos, realtime, mappers)
presentation/    páginas, componentes, hooks, view-state (Zustand)
ai/              tools, contexto, exemplos (sem regra de negócio)
server/          handlers para Edge Functions (opcional)
docs/            MODULE.md + CHANGELOG.md
tests/           unit, use-case, integration, e2e
```

## Camadas

### Domain
Entidades, value-objects, regras puras, validações, erros. Nunca conhece UI, DB, APIs, React, Supabase.

### Application
Coordena o comportamento: Commands, Queries, Capabilities, Policies, Validators, Events. Toda operação passa por aqui.

### Ports
Interfaces tipadas para todo I/O. Application depende delas, não das implementações.

### Infrastructure
Implementações de Ports: banco, storage, APIs externas, pagamentos, autenticação, cache, realtime. Troca de tecnologia ocorre só aqui.

### Presentation
Páginas, componentes, hooks, navegação, estados visuais. Nunca implementa regra de negócio — apenas usa Capabilities.

### AI
Registra Capabilities como tools, organiza contexto, fornece exemplos. Execução continua na Application.

## Estado no cliente
- **TanStack Query** = cache de queries. Chave = `capabilityId + input`. Invalidação por evento de domínio.
- **Zustand por módulo** = somente view-state. Nunca dado de servidor.
- **Realtime** = invalidador, não fonte primária. Canal multiplexado por módulo, com sequence anti-eco.

## Capabilities
Toda funcionalidade é uma Capability com: identificador único (`<modulo>.<entidade>.<verbo>`), descrição, entrada validada (Zod), saída definida, permissões, side-effects declarados, idempotência quando aplicável, auditoria quando aplicável, documentação, exemplos.

## Fonte única da verdade
Regra existe uma vez. Interface, Assistente, API, Mobile, Integrações consomem a mesma Capability.

## Eventos
Comunicação entre módulos via Event Bus tipado. Catálogo central. Capability só pode emitir eventos declarados em `sideEffects`.

## Segurança
Toda mutação valida autenticação, autorização, permissões e regras do domínio. RLS é a defesa final. O Assistente nunca tem privilégios superiores ao usuário.

## Auditoria
Pagamentos, contratos, exclusões, alterações financeiras, agenda e workflow são auditáveis.

## Interface
A UI não acessa banco, não implementa regras, não toma decisões de negócio. Apresenta dados e solicita operações.

## Assistente Lunari
Usa as mesmas Capabilities da UI. Nunca lógica paralela. Nunca modifica dados diretamente.

## Performance
Mínimo de consultas, reutilização de resultados, carregamento progressivo, atualização eficiente.

## Extensibilidade
Toda funcionalidade deve poder ser usada por: Interface Web, Assistente, Mobile, API, Integrações futuras. Se não, revisar arquitetura.

## Compatibilidade
Refatorações preservam compatibilidade. Migrações por etapas. Nenhum módulo é reescrito completamente sem necessidade.

## Documentação obrigatória
Cada `MODULE.md` contém: descrição, entidades, regras, capabilities, permissões, eventos, validações, fluxos, erros, dependências, exemplos, **Critérios do Produto** (as 6 perguntas do PRODUCT_GUIDE).

## Critério de aceitação
Implementação concluída quando: segue esta arquitetura, respeita a Constituição, tem documentação, capabilities registradas, reutiliza regras existentes, não duplica lógica, está pronta para o Assistente.
