## Auto-salvamento no Modal de Agendamento Pendente

### Problema atual
O `AppointmentDetails` (modal de detalhes do agendamento) só persiste alterações ao clicar em **Salvar**. Se o fotógrafo:
1. Abre um agendamento pendente
2. Adiciona/troca o pacote
3. Clica em "Cobrar cliente via link" e gera a cobrança
4. Fecha o modal (X, Cancelar, ou sai do app) sem clicar Salvar

→ As mudanças (pacote, valor de entrada, data, hora, observações) são perdidas, mas a cobrança já foi enviada com base em dados que não ficaram no agendamento. Resultado: inconsistência entre o que o cliente recebeu e o que está salvo.

### Objetivo
Salvar automaticamente, em background, qualquer alteração feita no modal de agendamento **pendente** (status `a confirmar`), com debounce curto, feedback visual sutil e proteção contra perda em fechamentos abruptos.

---

### Escopo do auto-save

**Quando ativa:** apenas para `status === 'a confirmar'` (pendentes). Confirmados continuam imutáveis nos campos editáveis.

**Campos monitorados** (todos do `formData`):
- `date`, `time`
- `packageId` (e o `type`/categoria derivado)
- `paidAmount` (valor de entrada)
- `description` (observações)
- `status` quando muda de `a confirmar` → `confirmado`
- `title` (já salvo via `ClientEditModal.onSuccess`, mantém)

**Não dispara auto-save:**
- Edição de cliente (já tem fluxo próprio)
- Briefing, histórico, modal de cobrança (são ações independentes)

---

### Estratégia de implementação

**1. Hook `useAppointmentAutosave`** (novo, em `src/hooks/`)
- Recebe `formData`, `appointmentId`, `onSave`, `enabled` (boolean = isPendente)
- Usa `useDebounce` (já existe, padrão 800–1000ms)
- Compara com snapshot inicial para evitar primeiro disparo
- Mantém ref `isSavingRef` para evitar concorrência
- Estado público: `saveStatus: 'idle' | 'saving' | 'saved' | 'error'` + `lastSavedAt`
- Retorna também `flushNow()` (salva imediatamente, sem debounce) — para uso antes de cobrança e antes de fechar

**2. Integração no `AppointmentDetails.tsx`**
- Instanciar `useAppointmentAutosave({ formData, enabled: isEditable, onSave: handleAutoSave })`
- `handleAutoSave` reaproveita a lógica de montagem de `appointmentData` do `handleSave` atual (extraída para função pura)
- **Antes de abrir `ChargeModal`**: chamar `await flushNow()` para garantir que pacote/valor estejam persistidos antes da cobrança ser gerada
- **Ao trocar status para confirmado**: também chamar `flushNow()` (mudança crítica)
- **No `onCancel` / fechar modal (`X`)**: se houver alteração pendente no debounce, chamar `flushNow()` antes de fechar (no AgendaModals/wrapper)
- **`beforeunload` listener** enquanto há save pendente, para alertar/forçar flush

**3. Indicador visual sutil no header do modal**
Substituir/complementar o badge de status com um micro-indicador à direita do título:
- `Salvando…` (spinner) durante save
- `Salvo agora` por 2s após sucesso (depois somem)
- `Erro ao salvar` (vermelho) com botão de retry
Padrão Notion-like, sem toasts (respeita memória `no-success-toasts`).

**4. Botões do footer (modo pendente)**
- "Salvar" deixa de ser obrigatório → renomear para **"Concluir"** (apenas fecha) OU manter como "Salvar e fechar" que faz `flushNow()` + `onCancel()`
- "Cancelar" passa a ser **"Fechar"** (já que tudo já foi salvo)
- Manter "Excluir" inalterado

Para `confirmado`: footer permanece como hoje (sem auto-save, exige clique em Salvar para os poucos campos editáveis — descrição).

---

### Fluxo do bug original, agora resolvido

```text
1. Abre pendente → snapshot inicial capturado
2. Seleciona pacote   ──┐
3. Digita valor entrada ┼─→ debounce 1s → autosave → "Salvo"
4. Clica "Cobrar"     →  flushNow() awaitado → ChargeModal abre
5. Cobrança gerada com pacote/valor já persistidos no DB
6. Fecha app/modal     → nada perdido
```

---

### Detalhes técnicos

**Arquivos a criar:**
- `src/hooks/useAppointmentAutosave.ts`

**Arquivos a alterar:**
- `src/components/agenda/AppointmentDetails.tsx` — extrair `buildAppointmentData()`, integrar hook, adicionar indicador no header, ajustar footer, awaitar `flushNow` antes de cobrança
- `src/components/agenda/AgendaModals.tsx` (wrapper) — chamar `flushNow` no fechamento se exposto via ref, OU mais simples: gerenciar o flush internamente no `AppointmentDetails` via `useEffect` cleanup

**Reuso:**
- `useDebounce` já existe (`src/hooks/useDebounce.ts`)
- Padrão de auto-save baseado no existente `useAutoSave` (em `user-profile/`), adaptado para o caso

**Edge cases:**
- Não auto-salvar se `formData === initialSnapshot` (evita save no mount)
- Atualizar snapshot após cada save bem-sucedido
- Se o usuário muda status para `confirmado` via toggle, o auto-save dispara `flushNow` (mudança crítica) e a partir daí campos viram read-only
- Erros de save: exibir badge vermelho persistente até nova edição/retry; não bloquear UI
- Realtime: quando `appointment` prop mudar de fora (ex: webhook de pagamento confirma), reinicializar snapshot/formData

---

### Resumo de UX

- Sem fricção: o fotógrafo nunca mais "esquece" de salvar
- Indicador sutil ao lado do nome ("Salvando…/Salvo")
- Cobrança sempre dispara com o estado já persistido
- Sem toasts de sucesso (consistente com o restante do sistema)
- Botão "Salvar" do footer vira "Fechar" no modo pendente (ou "Salvar e fechar" garantindo flush final)