## 📋 Sistema de Contratos — Arquitetura Multi-Modelo + Pronta para Assinatura Digital

Sistema completo de contratos com **arquitetura escalável desde o início**: múltiplos modelos suportados, contratos como cópias imutáveis, variáveis dinâmicas e preparação interna para integração futura com Autentique (ou similar).

---

## 🏗️ Princípios Arquiteturais (importantes!)

### 1. Multi-modelo desde o início
- A tabela `contrato_templates` suporta N modelos por usuário (sem limite técnico).
- A interface começa exibindo "1 modelo padrão" mas a UI já está preparada para listar, criar, duplicar e excluir vários.
- O seed inicial cria **apenas 1 modelo genérico** — o usuário pode criar quantos quiser.

### 2. Contrato ≠ Modelo (separação total)
- **Modelo (`contrato_templates`)**: molde reutilizável com placeholders (`{{cliente_nome}}`).
- **Contrato (`contratos`)**: cópia **imutável** gerada a partir do modelo, com variáveis já substituídas e conteúdo final salvo como HTML independente.
- Se o modelo for editado depois, contratos já gerados **não mudam** (integridade documental).
- Se o modelo for excluído, contratos gerados continuam intactos (sem FK rígida — `template_id` com `ON DELETE SET NULL`).

### 3. Variáveis dinâmicas como sistema de primeira classe
- Engine de substituição (`src/utils/contratoVariables.ts`) com catálogo extensível de variáveis.
- Variáveis suportadas no MVP:
  - `{{cliente_nome}}`, `{{cliente_email}}`, `{{cliente_telefone}}`, `{{cliente_endereco}}`, `{{cliente_cpf}}` (placeholder se inexistente)
  - `{{sessao_data}}`, `{{sessao_hora}}`, `{{sessao_categoria}}`, `{{sessao_pacote}}`, `{{sessao_descricao}}`
  - `{{sessao_valor_total}}`, `{{sessao_valor_pago}}`, `{{sessao_valor_restante}}`
  - `{{fotografo_nome}}`, `{{fotografo_email}}`, `{{fotografo_telefone}}`, `{{empresa_nome}}`, `{{empresa_cnpj}}`
  - `{{data_atual}}`, `{{data_extenso}}` (ex: "26 de abril de 2026")
- Sistema é extensível: novas variáveis se cadastram no catálogo sem migration.

### 4. Preparação para assinatura digital (sem implementar agora)
A tabela `contratos` já contém os campos necessários para integração futura:
- `signature_provider` (text) — ex: 'autentique', 'docusign', 'manual'
- `signature_external_id` (text) — ID do contrato na plataforma externa
- `signature_status` (text) — 'pending_signature', 'signed', 'expired', 'cancelled'
- `signature_url` (text) — link para assinatura
- `signed_at` (timestamp) — quando foi assinado externamente
- `signature_metadata` (jsonb) — payload bruto do provedor (auditoria)
- `signers` (jsonb) — array de signatários `[{name, email, role, signed_at}]`

A UI **não expõe** esses campos no MVP, mas eles existem prontos. Quando integrarmos Autentique, basta:
1. Adicionar Edge Function `autentique-create-document`
2. Mostrar botão "Enviar para assinatura digital" (atualmente oculto via feature flag)
3. Webhook atualiza `signature_status` automaticamente

---

## 🗄️ Estrutura do Banco de Dados

### Migration: `create_contratos_system.sql`

```sql
-- 1. TABELA DE MODELOS (templates reutilizáveis)
CREATE TABLE public.contrato_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  descricao text,
  conteudo text NOT NULL DEFAULT '', -- HTML do Tiptap com placeholders {{var}}
  is_padrao boolean DEFAULT false,   -- modelo padrão do usuário
  ordem integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. TABELA DE CONTRATOS (instâncias geradas — IMUTÁVEIS após assinatura)
CREATE TABLE public.contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cliente_id uuid NOT NULL,
  session_id text,                    -- text para alinhar com clientes_sessoes.session_id
  template_id uuid,                   -- referência ao modelo (sem FK rígida)
  
  -- Conteúdo final (snapshot)
  titulo text NOT NULL,
  conteudo_final text NOT NULL,       -- HTML já com variáveis substituídas
  variaveis_aplicadas jsonb DEFAULT '{}'::jsonb, -- snapshot das variáveis usadas
  
  -- Status do fluxo manual
  status text NOT NULL DEFAULT 'rascunho', -- rascunho | enviado | assinado
  enviado_em timestamptz,
  assinado_em timestamptz,
  
  -- Upload do contrato físico assinado
  arquivo_assinado_path text,         -- caminho no bucket client-documents
  arquivo_assinado_nome text,
  arquivo_assinado_tamanho bigint,
  
  -- 🔮 PREPARAÇÃO PARA ASSINATURA DIGITAL (não usado no MVP)
  signature_provider text,            -- 'autentique' | 'docusign' | 'manual'
  signature_external_id text,
  signature_status text,              -- pending_signature | signed | expired
  signature_url text,
  signed_at timestamptz,
  signature_metadata jsonb DEFAULT '{}'::jsonb,
  signers jsonb DEFAULT '[]'::jsonb,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT contratos_status_check CHECK (status IN ('rascunho','enviado','assinado'))
);

-- 3. ÍNDICES
CREATE INDEX idx_contrato_templates_user ON contrato_templates(user_id);
CREATE INDEX idx_contratos_user ON contratos(user_id);
CREATE INDEX idx_contratos_cliente ON contratos(cliente_id);
CREATE INDEX idx_contratos_session ON contratos(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_contratos_status ON contratos(user_id, status);

-- 4. RLS
ALTER TABLE contrato_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own templates" ON contrato_templates
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own contratos" ON contratos
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. TRIGGER: bloquear edição de conteúdo após assinado
CREATE OR REPLACE FUNCTION lock_contrato_assinado()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'assinado' AND (
    NEW.conteudo_final IS DISTINCT FROM OLD.conteudo_final OR
    NEW.titulo IS DISTINCT FROM OLD.titulo
  ) THEN
    RAISE EXCEPTION 'Não é possível editar conteúdo de contrato já assinado';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_lock_contrato_assinado
  BEFORE UPDATE ON contratos
  FOR EACH ROW EXECUTE FUNCTION lock_contrato_assinado();

-- 6. TRIGGER: updated_at em templates
CREATE TRIGGER trg_contrato_templates_updated
  BEFORE UPDATE ON contrato_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

### Storage
Reaproveita o bucket existente **`client-documents`** com estrutura: `{user_id}/contratos/{contrato_id}/{filename}.pdf`

---

## 🎨 Frontend — Componentes e Páginas

### 1. Editor Rich Text com Tiptap
**Novo:** `src/components/contratos/ContratoRichEditor.tsx`
- **Lib:** `@tiptap/react` + extensões `StarterKit`, `Underline`, `TextAlign`, `Link`
- **Toolbar:** Negrito, Itálico, Sublinhado, H1/H2/H3, Listas (•/1.), Alinhamento, Link, Desfazer/Refazer
- **Painel lateral de variáveis:** lista clicável agrupada (Cliente / Sessão / Empresa / Data) — clicar insere `{{var}}` no cursor
- Reutiliza padrão de foco estável (mem://architecture/estabilidade-foco-block-editor)

### 2. Engine de variáveis
**Novo:** `src/utils/contratoVariables.ts`
```ts
export const CATALOGO_VARIAVEIS = [
  { key: 'cliente_nome', label: 'Nome do cliente', grupo: 'Cliente' },
  { key: 'sessao_data', label: 'Data da sessão', grupo: 'Sessão', formatter: (v) => formatDate(v) },
  // ... ~20 variáveis
];

export function aplicarVariaveis(html: string, contexto: ContratoContexto): {
  html: string;
  variaveis_aplicadas: Record<string, string>; // snapshot p/ auditoria
} { /* substitui {{var}} pelos valores */ }
```

### 3. Geração de PDF
**Novo:** `src/utils/contratoPdf.ts` usando `html2pdf.js` (já instalado)
- Header com logo + nome da empresa (via `usuarios_perfil`)
- Conteúdo HTML formatado
- Footer com data de geração + página X/Y
- Layout A4, margens consistentes

### 4. Hook central
**Novo:** `src/hooks/useContratos.ts`
- `templates`, `contratos`, `isLoading`
- `createTemplate(data)`, `updateTemplate(id, data)`, `duplicateTemplate(id)`, `deleteTemplate(id)`
- `createContrato({ template_id, cliente_id, session_id? })` → busca dados, aplica variáveis, salva snapshot
- `updateContrato(id, data)` (bloqueado se status='assinado')
- `marcarComoEnviado(id)`, `marcarComoAssinado(id)`, `uploadAssinado(id, file)`
- `gerarPdf(id)`
- Realtime via Supabase channel

---

## 🖥️ Telas (3 pontos de acesso)

### Tela 1 — Configurações > Contratos (modelos)
**Novo:** `src/components/configuracoes/ContratosTemplates.tsx`
- Adicionar tab "Contratos" em `src/pages/Configuracoes.tsx` (ícone `FileSignature`)
- Lista de modelos com: nome, descrição, badge "Padrão", ações (Editar/Duplicar/Excluir)
- Botão **"+ Novo modelo"** abre modal de edição
- Modal de edição: Nome + Descrição + Editor Tiptap + Painel de variáveis lateral

### Tela 2 — Cliente > Documentos > Contratos
**Novo:** `src/components/contratos/ClienteContratosList.tsx`
- Adicionar nova seção (Card) em `src/components/cliente-detalhe/tabs/DocumentosTab.tsx` **acima** dos formulários
- Lista de contratos do cliente com:
  - Nome do contrato
  - Sessão vinculada (se houver) — link clicável
  - Status badge: 🟡 Rascunho / 🔵 Enviado / 🟢 Assinado
  - Data de criação
  - Menu de ações: Ver, Editar (se não assinado), Marcar como enviado/assinado, Upload assinado, Baixar PDF, Excluir
- Botão **"+ Novo contrato"** → modal de criação

### Tela 3 — Atalho na sessão (Workflow)
- Adicionar ícone `FileSignature` inline em `src/components/workflow/WorkflowCardCollapsed.tsx`
- Badge colorido sobre o ícone indicando status do contrato mais recente da sessão (ou cinza se não houver)
- Click abre **popover** com lista compacta de contratos da sessão + botão "+ Novo"

---

## 🔄 Fluxo de Criação de Contrato (Modal 3 etapas)

**Novo:** `src/components/contratos/NovoContratoModal.tsx`

### Etapa 1 — Escolha
- Select de modelo (combobox pesquisável — mem://ui/searchable-combobox-ui-pattern)
- Select de sessão (opcional, pré-selecionada se vier do Workflow)
- Cliente já vem do contexto

### Etapa 2 — Geração automática (silenciosa)
- Sistema busca dados do cliente, sessão, perfil do fotógrafo
- Aplica `aplicarVariaveis()` → gera HTML final + snapshot de variáveis
- Salva snapshot em `variaveis_aplicadas` (auditoria: o que foi inserido naquele momento)

### Etapa 3 — Revisão
- Editor Tiptap com conteúdo gerado, totalmente editável
- Aviso: "Após salvar, este contrato é independente do modelo original"
- Botões: **Salvar como rascunho** | **Salvar e marcar como enviado**

---

## 📊 Status e Comportamentos

| Status | Visual | Edição permitida | Ações |
|---|---|---|---|
| **Rascunho** | Badge âmbar | ✅ Sim | Editar, Marcar enviado, Excluir, Baixar PDF |
| **Enviado** | Badge azul | ⚠️ Com aviso | Marcar assinado, Upload assinado, Baixar PDF |
| **Assinado** | Badge verde | ❌ Bloqueado por trigger DB | Baixar PDF, Ver assinado |

**Upload de assinado:** aceita PDF/JPG/PNG, salva no Storage, muda status para `assinado` automaticamente.

---

## 🌱 Seed: Modelo Padrão Mínimo

Inserir **1 modelo genérico** durante a migration (via INSERT em modo `is_system`-like, mas atribuído ao primeiro acesso de cada usuário via trigger ou via hook na primeira visita à aba):

> **Contrato de Prestação de Serviços Fotográficos**
> 
> Pelo presente instrumento, **{{empresa_nome}}**, representada por **{{fotografo_nome}}**, doravante denominada CONTRATADA, e **{{cliente_nome}}**, doravante denominado CONTRATANTE, têm entre si justo e contratado o seguinte:
> 
> **1. Objeto**: Prestação de serviços fotográficos referente ao ensaio **{{sessao_categoria}}** ({{sessao_pacote}}) a ser realizado em **{{sessao_data}}** às **{{sessao_hora}}**.
> 
> **2. Valor**: O valor total dos serviços é de **R$ {{sessao_valor_total}}**.
> 
> **3. Entrega**: Conforme descrição: {{sessao_descricao}}
> 
> **4. Disposições gerais**: ...
> 
> {{data_extenso}}
> 
> _________________________  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; _________________________
> CONTRATANTE &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; CONTRATADA

---

## 📁 Arquivos a Criar/Modificar

### Novos
- `supabase/migrations/{timestamp}_create_contratos_system.sql`
- `src/types/contrato.ts` — interfaces TS
- `src/hooks/useContratos.ts` — hook central com realtime
- `src/utils/contratoVariables.ts` — engine de variáveis + catálogo
- `src/utils/contratoPdf.ts` — geração PDF via html2pdf.js
- `src/components/contratos/ContratoRichEditor.tsx` — Tiptap + painel variáveis
- `src/components/contratos/NovoContratoModal.tsx` — modal 3 etapas
- `src/components/contratos/ContratoViewerModal.tsx` — visualização + ações
- `src/components/contratos/ClienteContratosList.tsx` — lista no cliente
- `src/components/contratos/SessaoContratoIcon.tsx` — ícone+popover no Workflow
- `src/components/configuracoes/ContratosTemplates.tsx` — gestão de modelos
- `src/components/configuracoes/ContratoTemplateEditor.tsx` — modal de edição

### Modificados
- `src/pages/Configuracoes.tsx` — adicionar tab "Contratos"
- `src/components/cliente-detalhe/tabs/DocumentosTab.tsx` — adicionar Card de contratos
- `src/components/workflow/WorkflowCardCollapsed.tsx` — ícone inline com badge
- `package.json` — adicionar `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-underline`, `@tiptap/extension-text-align`, `@tiptap/extension-link`

---

## ✅ Garantias da Arquitetura

1. ✅ **Multi-modelo:** suporta N modelos por usuário desde o dia 1
2. ✅ **Não fixo:** nenhum contrato hardcoded; tudo vem de `contrato_templates`
3. ✅ **Conteúdo independente:** `contratos.conteudo_final` é snapshot imutável
4. ✅ **Variáveis dinâmicas:** engine extensível com catálogo + snapshot de aplicação
5. ✅ **Status + vínculo com sessão:** colunas `status` e `session_id` indexadas
6. ✅ **Pronto para assinatura digital:** 7 colunas reservadas (`signature_*`, `signers`) sem expor na UI

---

## 🚫 O que NÃO entra no MVP
- Integração real com Autentique (apenas estrutura preparada)
- Envio automático por e-mail
- Histórico de versões do contrato
- Assinatura inline (canvas)
- Notificações de prazo de assinatura
