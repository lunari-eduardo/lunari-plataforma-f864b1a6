# Auditoria de Banco de Dados: Módulo Comercial

## 1. Integridade de Gatilhos (Triggers)
A função `sync_active_version_on_publish` existe no banco de dados, porém a auditoria revelou que ela pode estar falhando silenciosamente ou não estar vinculada corretamente em todos os casos.
- **Evidência**: Encontramos o material **"Sessão Casal"** (ID `5f8fa4af...`) que possui uma versão publicada em `2026-08-22 18:11:40`, mas seu campo `active_version_id` na tabela `commercial_materials` está **nulo**.
- **Impacto**: O hook `useMaterialShares` (linha 42) lança um erro `O material precisa ser publicado antes de enviar` porque ele confia exclusivamente no `active_version_id` da tabela pai.

## 2. Segurança e RLS (Row Level Security)
- As tabelas `material_share_links` e `material_shares` estão com **Row Level Security DESATIVADO** (`rowsecurity: false`).
- Embora os dados estejam acessíveis, a falta de RLS nessas tabelas é uma vulnerabilidade crítica, pois permite que qualquer usuário autenticado (ou até anônimo, dependendo da configuração do PostgREST) possa listar ou modificar links de outros fotógrafos se descobrir o ID/Slug.

## 3. Estrutura de Normalização (Potencial de Crash)
- O `useMaterialEditor.ts` utiliza a função `normalizeBlocks` que manipula profundamente o JSON retornado do banco.
- Se um bloco V1 for carregado sem a propriedade `data` (ou com `data` nulo), a função pode estourar um erro de referência ao tentar acessar caminhos como `d.title` ou `d.text`, o que explica o erro "Algo deu errado" no Editor.

## 4. Inconsistência de Link Público
- O material "Sessão Casal" já possui um link gerado na tabela `material_share_links` (slug `sessao-casal-a86n`), mas como o material pai não aponta para uma versão ativa, o sistema entra em loop tentando gerar um link para uma "proposta não publicada".

---

# Plano de Correção Sugerido (Fase 1.5)

### A. Reparo de Dados e Gatilho (SQL Migration)
1. Executar um script de reparo para preencher `active_version_id` em todos os materiais que possuem versões publicadas mas estão com o campo nulo.
2. Refatorar o trigger `trigger_sync_active_version` para garantir que ele dispare corretamente em `INSERT` e `UPDATE` na tabela `material_versions`.
3. Ativar RLS nas tabelas de compartilhamento e aplicar políticas de isolamento por `user_id`.

### B. Blindagem do Editor (Frontend)
1. Adicionar `Optional Chaining` e `fallbacks` na função `normalizeBlock` em `src/pages/comercial/blocks/registry.ts`.
2. Implementar um log de erro detalhado no `ErrorBoundary` para que, caso ocorra outro crash, saibamos exatamente qual bloco causou o problema.

### C. Resiliência no Hook de Compartilhamento
1. Atualizar `useMaterialShares.ts` para buscar a última versão publicada como fallback caso `active_version_id` seja nulo, evitando o bloqueio do usuário enquanto o trigger sincroniza.

**Deseja que eu elabore a migração SQL para corrigir estes pontos imediatamente ou prefere revisar a blindagem do frontend primeiro?**
