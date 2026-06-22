# `<Nome do Módulo>` — MODULE.md

> Template oficial. Cada módulo Lunari **deve** ter um `docs/MODULE.md` seguindo esta estrutura.
> Seções 7-10 são **geradas** a partir do `application/manifest.ts` pelo script `bun run gen:module-docs`.
> Não edite-as manualmente.

```yaml
---
module: <id-do-modulo>      # ex.: agenda
version: 0.1.0
owners: [<time>]
status: draft | beta | stable
---
```

## 1. Objetivo do módulo
2-3 parágrafos. O quê resolve, para quem, e o que **não** é responsabilidade dele.

## 2. Glossário específico
Termos do domínio em PT-BR. Ex.: *slot*, *sessão*, *bloqueio*, *orçamento*, *etapa*.

## 3. Entidades
Para cada entidade:

- **Nome** (`Appointment`)
- Atributos principais
- Invariantes (regras que **nunca** podem ser quebradas)
- Tabela Supabase
- Relacionamentos

## 4. Regras de negócio
Numeradas com prefixo do módulo. Ex.:

- **RN-AGD-001** — Dois agendamentos do mesmo fotógrafo não podem sobrepor.
  Arquivo: `domain/services/conflicts.ts`

## 5. Validações
Referência aos schemas Zod em `application/validators/`. Ex.: `createAppointmentInput`.

## 6. Permissões
Matriz role × capability.

| Role | `agenda.appointment.create` | `agenda.appointment.reschedule` | … |
|---|---|---|---|
| admin | ✅ | ✅ | |
| photographer (owner) | ✅ | ✅ | |
| photographer (assistant) | ❌ | ✅ | |

---

## 7. Capacidades (gerado)
Tabela auto-gerada do manifesto: id · kind · descrição · permissions · sideEffects · needsApproval · costHint.

## 8. Actions disponíveis (gerado)
Commands com exemplos NL → input → output.

## 9. Queries disponíveis (gerado)
Idem para queries.

## 10. Eventos (gerado)
- **Emitidos**: nome, payload, consumidores conhecidos.
- **Consumidos**: origem, ação tomada.

---

## 11. Dependências
- Módulos: CRM, Financeiro, Workflow…
- Integrações externas: Asaas, MercadoPago, R2, Google Calendar…
- Planos exigidos: Studio Pro, Combo X…
- Tabelas Supabase, Edge Functions.

## 12. Fluxos principais
Diagramas ASCII passo a passo. Ex.: criar agendamento, remarcar, cancelar com estorno.

```text
[UI form] → command(createAppointment)
   → policies.authorize
   → domain.checkConflicts
   → ports.repo.insert
   → events.emit(agenda.created)
   → response → UI invalida cache
```

## 13. Fluxos alternativos
Conflitos, atrasos de pagamento, sessão sem cliente cadastrado, etc.

## 14. Casos de erro

| Código | Causa | Mensagem ao usuário | Retriable |
|---|---|---|---|
| `AGD_CONFLICT` | Sobreposição com outro agendamento | "Já existe um agendamento nesse horário." | não |

## 15. Restrições
Limites de plano, RLS, multi-tenant, idempotência, rate-limit, quotas externas.

## 16. Changelog
Link para `CHANGELOG.md` do módulo.
