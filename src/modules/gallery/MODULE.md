# Módulo Gallery

Camada de gestão (front-office) das galerias dentro do Lunari. Compartilha
banco com o projeto `lunari_gallery` (visualização do cliente final).

## Capabilities

| ID                     | Tipo   | Descrição                                                       |
| ---------------------- | ------ | --------------------------------------------------------------- |
| `gallery.checkAccess`  | query  | Fonte única de autorização (admin, assinatura, allowed_emails). |

## Dependências server-side

- Função `public.user_has_gallery_access(_user_id uuid)` (SECURITY DEFINER).

## Princípios

- Nunca decidir acesso a partir de localStorage/plan local — sempre RPC.
- UI consome a capability via `useCapabilityQuery` para cache e revalidação.

## Superfície AI (Assistente Lu)

- `ai/permissions.ts` — `REQUIRES_APPROVAL` inclui `gallery.reopenSelection`.
- `ai/tools.ts` — `listGalleryAITools` filtra por usuário/kind.
- `ai/context.ts` — `buildGalleryPageSnapshot` v1 com contadores, seleção,
  galerias visíveis e expiração próxima (≤ 7 dias).
- Registrado em `src/shared/ai/registry.ts` (`getPageSnapshot("gallery", user)`).

### Critérios de decisão (Guia do Produto v1.0)

1. **Autonomia**: Lu apenas consulta (`gallery.checkAccess`, listagens). Reabrir
   seleção exige aprovação humana explícita.
2. **Segurança**: nunca escreve storage; nunca decide acesso local; toda
   escrita cruza edge functions compartilhadas.
3. **Reversibilidade**: `reopenSelection` é reversível (fotógrafo pode
   fechar novamente) — mesmo assim entra em fila de aprovação.
4. **Escopo**: Lu não responde clientes finais; opera apenas sobre o
   ponto de vista do fotógrafo.
5. **Observabilidade**: toda invocação passa por `runCapabilityAsAssistant`
   → `assistant_invocations`.
6. **Custo**: snapshot ≤ ~6 KB; sem materialização; sem broadcast extra.
