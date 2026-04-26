## 🎯 Objetivo

Reduzir poluição visual no card colapsado do Workflow removendo o ícone de Contrato (pouco utilizado no acesso rápido) e movê-lo para o card **expandido**, com **identificação textual clara** (ícone + label + status), tornando o controle mais explícito e acessível quando o usuário realmente precisa.

---

## 📍 Situação Atual

### `WorkflowCardCollapsed.tsx` (linhas 478–494)
A "Zona 11" agrupa **dois ícones soltos** no canto direito:
- `<SessaoContratoIcon />` — ícone `FileSignature` 7x7 com bolinha de status
- Botão de excluir (`Trash2`)

Problemas:
- Ícone de contrato fica quase invisível (sem label) no meio das colunas
- Compete por espaço com o botão de excluir e demais ações
- Usuário não identifica facilmente que é "Contrato"
- É uma ação pouco frequente que ocupa espaço nobre

### `WorkflowCardExpanded.tsx` (Bloco 3 — Ações de Pagamento, linhas 431–473)
Já existe uma coluna vertical bem definida com:
- Cobrar
- Agendar pagamento manual
- (divisor)
- Pagamentos

É o lugar natural para receber o botão de Contrato.

---

## 🛠️ Mudanças Propostas

### 1. `src/components/workflow/WorkflowCardCollapsed.tsx`
- **Remover** o `<SessaoContratoIcon />` da Zona 11 (linhas 480–486)
- **Remover** o import `SessaoContratoIcon` (linha 25)
- A Zona 11 passa a conter **apenas** o botão de excluir, ficando mais limpa
- Manter a estrutura `flex items-center justify-center` (a div continua válida com 1 filho)

### 2. `src/components/workflow/WorkflowCardExpanded.tsx`

**a)** Importar o componente:
```tsx
import { SessaoContratoIcon } from "@/components/contratos/SessaoContratoIcon";
```

**b)** Adicionar uma nova seção dentro do **Bloco 3 — Ações de Pagamento** (após o botão "Pagamentos", linha 471), separada por divisor:

```tsx
{/* Divisor */}
<div className="w-full border-t border-border/20 my-1" />

{/* Contrato — ação documental, separada das ações de pagamento */}
{session.clienteId && (
  <SessaoContratoButton
    sessionId={session.sessionId || session.id}
    clienteId={session.clienteId}
    clienteNome={session.nome}
  />
)}
```

> O botão fica **dentro do mesmo bloco vertical** das ações, mantendo a coluna alinhada à direita (área "AÇÕES DE PAGAMENTO" da imagem). Apesar do título do bloco ser "Ações de Pagamento", podemos renomeá-lo para **"Ações"** para englobar contrato + pagamentos sem confusão semântica.

**c)** Renomear o título do bloco (linha 433) de `Ações de Pagamento` → `Ações`.

### 3. Novo componente `src/components/contratos/SessaoContratoButton.tsx`

Cria uma variante **com label** do `SessaoContratoIcon` (que continuará existindo para outros usos eventuais), com a mesma lógica interna (Popover de listagem, modal de novo contrato, modal viewer), mas renderizada como um **botão largo** semelhante a "Cobrar"/"Pagamentos":

- Largura total (`w-full`) para alinhar com os outros botões da coluna
- Ícone `FileSignature` + texto **"Contrato"** ou **"Contratos (N)"** quando houver
- Badge de status à direita (cor da bolinha já existente em `dotColor`) quando houver contrato no status mais avançado
- Variante `outline` para diferenciar de "Cobrar"/"Agendar" (ações primárias)
- Reaproveita 100% da lógica atual: `useContratos`, `STATUS_PRIORITY`, `Popover` com lista, `NovoContratoModal`, `ContratoViewerModal`

Estrutura visual aproximada:
```
┌─────────────────────────────┐
│ 📄  Contrato         ● Enviado│   ← sem contratos: "Contrato"
└─────────────────────────────┘   ← com contratos: "Contratos (2)" + badge
```

### 4. Verificar outros usos de `SessaoContratoIcon`
Rodar busca para confirmar que o componente original não está sendo usado em outro lugar além do card colapsado. Se não estiver, ele pode permanecer no projeto (não-disruptivo) ou ser removido — preferência por **manter** para não quebrar imports indiretos.

---

## ✅ Resultado Esperado

- **Card colapsado**: mais limpo, sem ícone órfão de contrato. Apenas Galerias + Excluir na zona final
- **Card expandido**: contrato passa a ser uma ação clara, identificável e bem posicionada junto às demais ações da sessão
- **UX**: usuário acessa contrato de forma intencional (ao expandir o card), sem perder funcionalidade
- **Identificação**: label "Contrato" + status visual eliminam ambiguidade do ícone solto

---

## 📁 Arquivos Afetados

- `src/components/workflow/WorkflowCardCollapsed.tsx` — remover ícone e import
- `src/components/workflow/WorkflowCardExpanded.tsx` — adicionar botão no Bloco 3, renomear título
- `src/components/contratos/SessaoContratoButton.tsx` — **novo** componente (variante com label)