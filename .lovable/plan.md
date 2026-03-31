

# Renomeação Global de Categorias + Feedback Visual

## Situação Atual

- `clientes_sessoes.categoria` armazena o **nome da categoria como texto**, não um FK para `categorias.id`
- Quando o fotógrafo renomeia uma categoria (ex: "Ensaio gestante" → "Gestante Premium"), o nome atualiza na tabela `categorias` mas **sessões, orçamentos e relatórios continuam com o nome antigo**
- A edição inline já existe no componente `Categorias.tsx` mas o feedback visual pode não ser imediato dependendo do realtime

## Regra de Negócio

- **Categoria = identidade editável** — pode ser renomeada a qualquer momento
- **Regras de preço = congeladas na sessão** — via `regras_congeladas` em `clientes_sessoes`, nunca muda após criação
- Renomear categoria **NÃO altera** valores, pacotes, modelos de preço ou dados financeiros das sessões

## Plano

### 1. Trigger SQL: Propagar renomeação automaticamente

Criar trigger `on_categoria_renamed` na tabela `categorias` (AFTER UPDATE) que:

- Detecta quando `OLD.nome != NEW.nome`
- Atualiza `clientes_sessoes.categoria = NEW.nome` WHERE `categoria = OLD.nome AND user_id = NEW.user_id`
- Isso garante que sessões, workflow, relatórios e CRM reflitam o novo nome instantaneamente
- **Não toca em** `regras_congeladas`, `valor_base_pacote`, `valor_foto_extra` — esses ficam intactos

### 2. Feedback visual imediato na UI

O componente `Categorias.tsx` já faz update otimista via `categoriasOps.update()`. Vou garantir que:

- Após `save()`, o `editNome` local e o `categoria.nome` da prop fiquem sincronizados
- O componente use `categoria.nome` atualizado após o save (não precisa esperar realtime)
- Remover o toast redundante "Categoria atualizada com sucesso!" (seguindo o padrão já estabelecido de eliminar toasts desnecessários)

### 3. Remover toasts de sucesso em Categorias e Etapas

Seguindo o padrão já aprovado de remover notificações redundantes quando a UI mostra resposta visual:

- `useConfiguration.ts` / `ConfigurationContext.tsx`: remover `toast.success` de `atualizarCategoria`, `adicionarCategoria`, `removerCategoria`
- Idem para etapas: `adicionarEtapa`, `atualizarEtapa`, `removerEtapa`
- Manter `toast.error` para falhas

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| Nova migração SQL | Trigger `on_categoria_renamed` para propagar nome em `clientes_sessoes` |
| `src/contexts/ConfigurationContext.tsx` | Remover toasts de sucesso em operações de categorias e etapas |
| `src/hooks/useConfiguration.ts` | Remover toasts de sucesso em operações de categorias e etapas |

## O que NÃO muda

- `regras_congeladas` nas sessões — ficam intactas
- Valores financeiros — nenhum recálculo
- Estrutura de pacotes — continuam referenciando `categoria_id` (FK), sem problema
- Modelos de preço — `tabelas_precos` usa `categoria_id`, não nome

