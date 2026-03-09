

# Sistema de Formulários Inteligentes — Implementação Refinada

## Resumo das Mudanças Incorporadas

Todas as sugestões foram incorporadas ao plano:

1. ✅ Aba em Configurações (não página na sidebar)
2. ✅ `status_envio` para tracking com cliente
3. ✅ Snapshot de campos (independente do template)
4. ✅ Campo `ordem` no JSON de campos
5. ✅ `titulo_cliente` separado do título interno
6. ✅ Página pública: tempo estimado, progresso, mensagem final
7. ✅ Tipo `upload_referencia` para referências visuais
8. ✅ Lista com sessão vinculada e data
9. ✅ Fluxo de criação melhorado

---

## Arquitetura de Dados (Supabase)

### Tabela `formulario_templates`
```sql
id UUID PRIMARY KEY
user_id UUID (null = template do sistema)
nome TEXT
categoria TEXT (gestante, newborn, familia, casamento)
descricao TEXT
campos JSONB
is_system BOOLEAN
tempo_estimado INTEGER (minutos)
created_at, updated_at
```

### Tabela `formularios`
```sql
id UUID PRIMARY KEY
user_id UUID NOT NULL
template_id UUID (referência ao template usado, apenas histórico)
titulo TEXT (interno: "Briefing Gestante Ana")
titulo_cliente TEXT (para cliente: "Questionário pré-ensaio")
descricao TEXT
campos JSONB (snapshot independente)
mensagem_conclusao TEXT
tempo_estimado INTEGER (minutos)

-- Vínculos
cliente_id UUID
session_id TEXT (appointment_id ou session_id)

-- Status
status TEXT DEFAULT 'rascunho' (rascunho | publicado | arquivado)
status_envio TEXT DEFAULT 'nao_enviado' (nao_enviado | enviado | respondido | expirado)
enviado_em TIMESTAMPTZ
respondido_em TIMESTAMPTZ

-- Acesso público
public_token TEXT UNIQUE
expires_at TIMESTAMPTZ

created_at, updated_at
```

### Tabela `formulario_respostas`
```sql
id UUID PRIMARY KEY
formulario_id UUID NOT NULL
user_id UUID (fotógrafo dono)
respondente_nome TEXT
respondente_email TEXT
respostas JSONB
submitted_at TIMESTAMPTZ
created_at
```

### Estrutura do Campo (JSONB)
```json
{
  "id": "uuid",
  "tipo": "texto_curto | texto_longo | multipla_escolha | selecao_unica | data | upload_imagem | upload_referencia | selecao_cores",
  "label": "Nome do bebê",
  "placeholder": "Ex: Sofia",
  "ordem": 1,
  "obrigatorio": true,
  "opcoes": ["Opção 1", "Opção 2"],
  "descricao": "Texto de ajuda opcional"
}
```

### Bucket Storage
`formulario-uploads` — público para INSERT, fotos de referência

---

## Estrutura de Arquivos

```
src/types/formulario.ts                          — Tipos TypeScript
src/hooks/useFormularioTemplates.ts              — CRUD templates
src/hooks/useFormularios.ts                      — CRUD formulários
src/components/configuracoes/
  FormulariosConfig.tsx                          — Aba principal (lista + CRUD templates)
  FormularioTemplateEditor.tsx                   — Editor de template com drag-and-drop
  FormularioFieldEditor.tsx                      — Editor de campo individual
src/pages/FormularioPublico.tsx                  — Página pública (cliente preenche)
```

---

## Componentes da Aba Configurações

### `FormulariosConfig.tsx`
- Lista de templates do sistema (read-only) e customizados
- Criar novo template
- Duplicar template existente
- Editar/excluir templates customizados

### `FormularioTemplateEditor.tsx`
- Nome, categoria, descrição, tempo estimado
- Lista de campos com drag-and-drop (dnd-kit)
- Adicionar campos por tipo
- Preview lado a lado (desktop)

---

## Página Pública `/formulario/:token`

Layout mobile-first:
1. **Header**: Logo do estúdio + título do formulário
2. **Info**: "Leva cerca de X minutos"
3. **Progresso**: "Pergunta 3 de 7" + barra visual
4. **Campos**: Um por vez ou scroll suave
5. **Envio**: Botão destacado
6. **Conclusão**: Mensagem personalizada + check animado

---

## Templates Pré-carregados (seed)

4 templates com `is_system = true`:
- **Ensaio Gestante** (7 campos, ~3 min)
- **Newborn** (7 campos, ~2 min)
- **Ensaio Família** (6 campos, ~2 min)
- **Casamento/Evento** (6 campos, ~4 min)

Cada um inclui pelo menos 1 campo `upload_referencia` para fotos de inspiração.

---

## Alterações em Configuracoes.tsx

- Adicionar aba "Formulários" com ícone `ClipboardList`
- Posicionar após "Etapas" na TabsList
- Carregar componente `FormulariosConfig`

---

## Escopo da Implementação

**Fase 1** (esta implementação):
- Migration: 3 tabelas + RLS + bucket + seed templates
- Tipos TypeScript
- Hooks de CRUD
- Aba FormulariosConfig em Configurações
- Editor de templates com todos os 8 tipos de campo
- Página pública com UX completa

**Fase 2** (futura):
- Modal de agendamento: vincular formulário à sessão
- Envio de link por WhatsApp/email
- Visualização de respostas no workflow

