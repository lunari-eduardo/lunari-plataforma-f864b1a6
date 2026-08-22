# Plano de Investigação e Correção: Editor de Propostas e Links Públicos

## Problemas Identificados
1. **Erro de Publicação Fantasma**: O sistema impede a geração de links rastreáveis alegando que a proposta não está publicada, mesmo quando o usuário já clicou em "Publicar".
2. **Crash Crítico no Editor**: Erro "Algo deu errado" ao tentar acessar o construtor, impedindo qualquer edição.

---

## Análise Técnica Preliminar

### 1. Link Público vs. Versão Ativa
No arquivo `useMaterialShares.ts` (linhas 34-42), existe uma trava explícita:
```typescript
if (!material.active_version_id) throw new Error('O material precisa ser publicado antes de enviar.');
```
O problema é que `active_version_id` na tabela `commercial_materials` é atualizado via trigger no Supabase (`sync_active_version_on_publish`) quando uma linha em `material_versions` ganha um `published_at`.
- **Hipótese A**: O trigger está falhando ou não existe em alguns ambientes, deixando o material sem `active_version_id` mesmo com versões publicadas.
- **Hipótese B**: A interface de "Publicar Versão" no `EditorPropostaPage.tsx` está criando a versão mas o estado local ou o cache do TanStack Query não está refletindo a atualização do ID do material pai.

### 2. Erro "Algo deu errado" (Runtime Crash)
Este erro é disparado pelo `RootErrorBoundary`. As causas prováveis para o Editor especificamente:
- **Falha na Normalização de Blocos**: O `useMaterialEditor.ts` chama `normalizeBlocks(version.content)`. Se o JSON no banco estiver corrompido ou em um formato V1 inesperado, a função pode lançar uma exceção não tratada.
- **Recursão Infinita de Tipos**: Já corrigimos um erro similar em `useSupabaseGalleries`, pode haver outro no `useMaterialEditor` ao lidar com as tabelas de versões.
- **Propriedades Indefinidas**: O `VisualRenderer` ou `EditorialComposition` podem estar tentando acessar `designTokens` ou `props` de um bloco que veio nulo do banco.

---

## Plano de Ação (Fase de Investigação)

### Passo 1: Auditoria de Banco de Dados (Investigação Imediata)
- Verificar a existência e integridade do trigger `sync_active_version_on_publish`.
- Validar se existem materiais com `published_at` em suas versões mas com `active_version_id` nulo na tabela pai.
- Verificar permissões RLS na tabela `material_share_links` e `material_versions`.

### Passo 2: Debug de Runtime e Resiliência (Correção do Crash)
- Implementar logs defensivos no `useMaterialEditor` para capturar o erro exato antes dele subir para o `ErrorBoundary`.
- Adicionar `try/catch` na função `normalizeBlocks` com fallback para um array vazio em vez de crashar a página toda.
- Validar o schema do `globalSettings` durante o carregamento.

### Passo 3: Sincronização de Publicação (Correção do Link)
- Alterar `useMaterialShares` para, em caso de `active_version_id` nulo, tentar buscar a última versão com `published_at` antes de desistir.
- Garantir que `editor.publish()` invalide corretamente a query `['commercial-materials']` e a query do material específico.

### Passo 4: Validação em Preview
- Criar um script Playwright para reproduzir o fluxo: Criar -> Publicar -> Gerar Link.
- Capturar logs do console durante o processo para identificar falhas silenciosas.

---

## Próximos Passos Sugeridos
1. **Não implementar nada ainda**, conforme instrução.
2. Aguardar confirmação se houve alguma alteração recente no schema de `commercial_materials` ou `material_versions`.
3. Autorizar a execução dos comandos de auditoria de trigger no banco.
