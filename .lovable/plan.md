## Causa raiz

`AppointmentDetails` já tem autosave (debounce 800ms) que dispara `onSave` a cada alteração. Esse `onSave` aponta para `handleSaveAppointment` em `src/pages/Agenda.tsx`, que no branch `viewingAppointment` executa `setIsDetailsOpen(false)` — ou seja, **toda gravação automática fecha o modal**, inclusive ao digitar uma letra na descrição ou mudar o horário.

Além disso, ao desmontar o modal, o `useEffect` de cleanup já chama `flushNow()`, então qualquer alteração pendente é persistida no fechamento. Logo, não precisamos fechar o modal no autosave.

## Solução

Separar autosave (silencioso, mantém modal aberto) de save manual (fecha modal). Sem mudar lógica de banco, multiusuário ou triggers.

### 1. `src/components/agenda/AgendaModals.tsx`
- Adicionar prop `onAutoSaveAppointment: (data) => Promise<void> | void`.
- Passar essa prop para `<AppointmentDetails onAutoSave={...} onSave={...} />`.

### 2. `src/components/agenda/AppointmentDetails.tsx`
- Adicionar prop opcional `onAutoSave?: (data) => Promise<void>`.
- No hook `useAppointmentAutosave`, usar `onAutoSave ?? onSave` (fallback compatível).
- `handleStatusSelect('confirmado')` continua usando `onSave` (queremos fechar/atualizar ao confirmar — manter comportamento atual). Opcional: também usar autosave silencioso aqui se a UX preferir manter aberto. Manter `onSave` por enquanto para não mudar fluxo de confirmação.
- Botão "Salvar" (status confirmado, não editável) e "Fechar" (após `flushNow`) continuam usando `onSave` → fecham normalmente.

### 3. `src/pages/Agenda.tsx`
- Criar `handleAutoSaveAppointment`:
  ```ts
  const handleAutoSaveAppointment = useCallback(async (data) => {
    const id = editingAppointment?.id ?? viewingAppointment?.id;
    if (!id) return;
    try {
      await updateAppointment(id, data);
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + e.message);
    }
    // NÃO fecha o modal
  }, [editingAppointment, viewingAppointment, updateAppointment]);
  ```
- Passar `onAutoSaveAppointment={handleAutoSaveAppointment}` ao `AgendaModals`.
- `handleSaveAppointment` (manual) permanece como está, fechando o modal.

### 4. UX
- Indicador "Salvando…/Salvo" já existe no header (linhas 231-271). Mantém feedback visual claro.
- Botão "Fechar" continua chamando `flushNow()` antes de fechar — garante persistência final.
- Sem toasts de sucesso (regra do projeto).

## Arquivos afetados
- `src/components/agenda/AppointmentDetails.tsx` (1 prop nova + 1 linha no hook)
- `src/components/agenda/AgendaModals.tsx` (passar nova prop)
- `src/pages/Agenda.tsx` (nova função `handleAutoSaveAppointment`)

## Riscos
- Nenhum impacto em multiusuário: usa o mesmo `updateAppointment` já existente.
- Nenhuma mudança em triggers, RLS ou edge functions.
- Compatível: se `onAutoSave` não for passado, cai no `onSave` (comportamento antigo).
