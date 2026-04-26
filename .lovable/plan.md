
# 📋 Refatoração — CRM › Cliente › Aba Documentos

Transformar os blocos de **Briefings** e **Contratos** em **listas compactas tipo linha** (uma por item), com ações inline e menu **⋮** padronizado, eliminando o excesso de altura, espaço vazio e ações distantes do conteúdo.

---

## 🎯 Diagnóstico atual

**`DocumentosTab.tsx`** envolve cada lista em um `<Card>` com `pt-6` → gera muito padding vertical. Dentro:

- **`ClienteFormulariosList.tsx`**: cada item é um bloco `border rounded-lg p-3 space-y-2` com 2 linhas + botão de ação largura total → cards altos demais.
- **`ClienteContratosList.tsx`**: itens são `<Card>` clicáveis sem ação visível, sem badge de status alinhada à direita e **sem possibilidade de excluir pela lista** (só pelo modal).
- Sem menu **⋮** em nenhum dos dois.
- Briefings respondidos não podem ser excluídos pela UI (só via banco). O FK já tem `ON DELETE CASCADE` → confirmado seguro excluir e arrastar respostas junto.

---

## 🧱 Estrutura final de cada linha (padrão único)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [icon] Nome do item            │ [Ação principal] │ [Status badge] │  ⋮      │
│        meta secundária (data)  │                  │                │         │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Altura alvo:** ~52px (vs ~96px atuais).
- **Hover:** `bg-accent/40`, sem elevar shadow.
- **Clique na linha (fora dos botões):** abre ação principal (ver respostas / abrir contrato).

---

## 1. Novo componente compartilhado

**Criar `src/components/cliente-detalhe/shared/CompactItemRow.tsx`**

Linha reutilizável padronizada para briefings, contratos e (futuramente) outros documentos:

```tsx
interface CompactItemRowProps {
  icon?: ReactNode;
  title: string;
  meta?: string;            // ex: "Enviado em 07/04/2026"
  status?: ReactNode;       // badge JSX
  primaryAction?: { label: string; icon: ReactNode; onClick: () => void };
  menuItems: Array<{
    label: string;
    icon: ReactNode;
    onClick: () => void;
    variant?: 'default' | 'destructive';
    separatorBefore?: boolean;
  }>;
  onRowClick?: () => void;
}
```

- Menu **⋮** via `DropdownMenu` (shadcn).
- `primaryAction` aparece como botão `ghost` discreto à direita do meta, antes da badge.
- Mobile (<sm): primaryAction colapsa para dentro do menu ⋮.

---

## 2. `ClienteFormulariosList.tsx` — refatoração

Trocar o bloco atual pelo `CompactItemRow`:

| Estado | Ação principal | Itens do menu ⋮ |
|---|---|---|
| `respondido` | **Ver respostas** (Eye) | Ver respostas · Copiar link · **Excluir** (vermelho, com confirmação) |
| `enviado` | **Copiar link** (Copy) | Copiar link · Reenviar via WhatsApp · **Excluir** |
| `expirado` / `nao_enviado` | **Copiar link** (se houver token) | Copiar link · **Excluir** |

**Exclusão:**
- Importar `deleteFormulario` de `useFormularios()`.
- Se `status_envio === 'respondido'` → `AlertDialog`:  
  *"Esta ação excluirá também todas as respostas enviadas pelo cliente. Deseja continuar?"*
- Caso contrário → exclusão direta sem confirmação (consistente com a política de toasts mínimos; exibir só `toast.error` em caso de falha).

Header da seção continua: `📄 Formulários / Briefings` + botão `+ Enviar briefing`.

---

## 3. `ClienteContratosList.tsx` — refatoração

Mesma `CompactItemRow`. Header mantém ícone, título, contagem e botão `+ Novo contrato`.

| Status | Ação principal | Itens do menu ⋮ |
|---|---|---|
| `rascunho` | **Abrir** | Abrir · Baixar PDF · Marcar como enviado · **Excluir** |
| `enviado` | **Abrir** | Abrir · Baixar PDF · Marcar como assinado · **Excluir** |
| `assinado` | **Abrir** | Abrir · Baixar PDF · Baixar PDF assinado (se houver) · **Excluir** |

**Mudanças funcionais:**
- Status badge passa a ficar à direita (alinhado com formulários).
- **Excluir direto da lista** via `remove(contrato.id)` do hook `useContratos`, com `AlertDialog` de confirmação simples ("Excluir contrato? Esta ação não pode ser desfeita.").
- "Baixar PDF" reutiliza `downloadContratoPdf` (mesma lógica do modal) — extrair para handler compartilhado dentro da lista.
- "Marcar como enviado/assinado" chama `setStatus({ id, status })`.

---

## 4. `DocumentosTab.tsx` — container

Substituir os 3 `<Card>` largos por:

```tsx
<div className="space-y-6 max-w-4xl">
  <section> {/* Briefings */} </section>
  <Separator />
  <section> {/* Contratos */} </section>
  <Separator />
  <section> {/* Upload de documentos */} </section>
</div>
```

- **Reduzir largura:** `max-w-4xl` (vs full-width atual) → respeita padrão Notion/Stripe.
- Remover wrappers `<Card>` redundantes; cada seção usa apenas título + lista, sem chrome extra.
- Manter `FileUploadZone` na seção "Documentos do Cliente" (sem alteração funcional, apenas remover `<Card>` ao redor).

---

## 5. Padronização de notificações

Seguindo a regra de memória (`politica-notificacao-sucesso-minimalista`):

- ❌ Sem toast de sucesso para: copiar link, abrir, marcar como enviado/assinado, excluir.
- ✅ Manter `toast.error` apenas em falhas reais.
- Exceção: **copiar link** mantém um toast curto ("Link copiado!") por ser uma ação cega (sem feedback visual no DOM) — já existe e é útil.

---

## 6. Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/components/cliente-detalhe/shared/CompactItemRow.tsx` | **Criar** |
| `src/components/cliente-detalhe/tabs/DocumentosTab.tsx` | Refatorar layout (sem Cards, max-w-4xl, separators) |
| `src/components/formularios/ClienteFormulariosList.tsx` | Migrar para `CompactItemRow` + adicionar exclusão com confirmação condicional |
| `src/components/contratos/ClienteContratosList.tsx` | Migrar para `CompactItemRow` + ações inline (baixar PDF, marcar enviado, excluir) |

Sem mudanças de banco. Sem mudanças em hooks (todos os métodos necessários — `deleteFormulario`, `remove`, `setStatus`, `downloadContratoPdf` — já existem).

---

## ✅ Resultado esperado

- Densidade ~2x maior (4-5 itens visíveis sem scroll vs 2 atuais).
- Ações no mesmo eixo visual do item — zero deslocamento ocular.
- Exclusão possível em qualquer estado, com proteção apenas onde há perda de dados (respostas).
- Visual consistente entre briefings e contratos.
- Largura controlada (`max-w-4xl`) → leitura mais confortável em telas largas.
