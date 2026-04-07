

# Sistema de Envio e Respostas de Formulários

## Visão geral

O banco de dados já tem toda a estrutura pronta (`formularios` com `cliente_id`, `session_id`, `public_token`, `status_envio`; `formulario_respostas` com `respostas` JSONB). A página pública (`/formulario/:token`) já funciona para submissão. O que falta é:

1. **Criar formulário a partir de um template** — vinculado a cliente/sessão
2. **Enviar link** — via WhatsApp/copiar link, direto dos modais da Agenda e do CRM
3. **Visualizar respostas** — página dedicada para o fotógrafo ver as respostas

---

## Etapas

### 1. Componente "Enviar Briefing" (reutilizável)

Novo componente `SendBriefingModal` que:
- Lista os templates disponíveis (sistema + customizados)
- Ao selecionar, cria um `formulario` vinculado ao `cliente_id` e `session_id` (se disponível)
- Publica automaticamente (status = `publicado`, status_envio = `enviado`)
- Gera o link público (`/formulario/{public_token}`)
- Oferece 2 ações: **Copiar link** e **Enviar via WhatsApp** (abre `wa.me/{telefone}?text=...`)

### 2. Integração na Agenda — AppointmentDetails

No modal de detalhes do agendamento (`AppointmentDetails.tsx`), adicionar um botão/seção colapsável **"📋 Enviar Briefing"** abaixo das Observações e acima do Histórico da Sessão. O botão:
- Abre o `SendBriefingModal` passando `clienteId` e `sessionId` (do appointment)
- Mostra badge se já existe formulário enviado/respondido para essa sessão
- Se já respondido, abre a visualização das respostas

### 3. Integração no CRM — ClienteDetalhe (aba Documentos)

Na aba "Documentos" do perfil do cliente (`DocumentosTab.tsx`), adicionar uma seção **"Formulários / Briefings"** que:
- Lista todos os formulários vinculados a esse cliente (com status de envio)
- Botão "Enviar novo briefing" que abre o `SendBriefingModal` com `clienteId`
- Cada formulário mostra: título, data de envio, status (badge colorido), e botão para ver respostas

### 4. Página de Visualização de Respostas

Novo componente `FormularioRespostasView` (pode ser modal ou página inline) que:
- Recebe `formularioId`
- Usa `useFormularioRespostas` (já existe) para buscar respostas
- Renderiza cada campo com a pergunta original (do JSON `campos`) e a resposta correspondente
- Para campos de upload, mostra preview das imagens
- Para seleção de cores, mostra as cores selecionadas
- Para múltipla escolha, mostra as opções marcadas
- Header com: nome do cliente, data de resposta, status

### 5. Lista geral de formulários (na aba Documentos do CRM)

Seção que mostra todos os briefings do cliente com status visual:
```
┌──────────────────────────────────────────┐
│ 📋 Briefing Gestante                     │
│ Enviado em 05/04 • ● Aguardando resposta │
│                        [Copiar link] [👁] │
├──────────────────────────────────────────┤
│ 📋 Briefing Newborn                      │  
│ Respondido em 06/04 • ✅ Respondido      │
│                         [Ver respostas]  │
└──────────────────────────────────────────┘
```

---

## Arquivos a criar

| Arquivo | Descrição |
|---------|-----------|
| `src/components/formularios/SendBriefingModal.tsx` | Modal para selecionar template e enviar briefing |
| `src/components/formularios/FormularioRespostasView.tsx` | Visualização das respostas recebidas |
| `src/components/formularios/ClienteFormulariosList.tsx` | Lista de formulários de um cliente |

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/agenda/AppointmentDetails.tsx` | Adicionar botão/seção "Enviar Briefing" |
| `src/components/cliente-detalhe/tabs/DocumentosTab.tsx` | Adicionar seção de Formulários/Briefings |
| `src/hooks/useFormularios.ts` | Adicionar query `useFormulariosByCliente` e `useFormulariosBySession` |

## Fluxo completo

```text
Fotógrafo abre Agenda → Detalhes do Agendamento
  └→ Clica "Enviar Briefing"
     └→ Seleciona template (ex: Gestante)
        └→ Sistema cria formulário + publica
           └→ Copia link ou envia WhatsApp
              └→ Cliente abre link no celular
                 └→ Responde o formulário
                    └→ Status muda para "Respondido"
                       └→ Fotógrafo vê respostas no CRM ou Agenda
```

