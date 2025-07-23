# Testes de Integração Agendamento/Orçamento → Workflow

## Funcionalidades Implementadas

### 1. Mapeamento Automático de Pacotes para Workflow

#### ✅ De Agendamentos Confirmados:
- **Gatilho**: Agendamento com status "confirmado"
- **Dados mapeados**:
  - `appointment.packageId` → Busca pacote completo nos dados de configuração
  - `pacote.nome` → `workflow.pacote`
  - `pacote.valor_base` → `workflow.valorPacote`
  - `pacote.valor_foto_extra` → `workflow.valorFotoExtra`
  - `pacote.categoria_id` → `workflow.categoria` (via lookup de categorias)
  - `pacote.produtosIncluidos` → `workflow.produto` (primeiro produto incluído)

#### ✅ De Orçamentos Fechados:
- **Gatilho**: Orçamento com status "fechado"
- **Dados mapeados**:
  - `orcamento.pacotes[0]` → Busca pacote completo nos dados de configuração
  - Mesmo mapeamento de dados que agendamentos

### 2. Categoria Reativa

#### ✅ Atualização Automática:
- Quando pacote é alterado no Workflow, categoria é atualizada automaticamente
- Busca categoria pelo `categoria_id` do pacote
- Fallback para nome da categoria se não encontrar ID

### 3. Produtos Incluídos

#### ✅ Mapeamento de Produtos:
- Se pacote tem `produtosIncluidos`, adiciona primeiro produto ao Workflow
- Mapeia quantidade e valor total do produto

### 4. Componente PackageCombobox Melhorado

#### ✅ Integração com useOrcamentoData:
- Não depende mais de props `packageOptions`
- Usa dados mapeados e normalizados do hook
- Busca automática de pacotes das configurações

## Estruturas de Dados Esperadas

### Pacote de Configuração:
```json
{
  "id": "1",
  "nome": "Básico",
  "categoria_id": "3",
  "valor_base": 450,
  "valor_foto_extra": 25,
  "produtosIncluidos": [
    {
      "produtoId": "prod1",
      "quantidade": 1
    }
  ]
}
```

### Categoria de Configuração:
```json
{
  "id": "3",
  "nome": "Fotografia",
  "cor": "#007AFF"
}
```

### Produto de Configuração:
```json
{
  "id": "prod1",
  "nome": "Album Digital",
  "valorVenda": 150,
  "categoria": "Digital"
}
```

## Casos de Teste

### Teste 1: Agendamento → Workflow
1. Criar agendamento com `packageId` válido
2. Definir status como "confirmado"
3. Verificar se item aparece no Workflow com todos os dados do pacote

### Teste 2: Orçamento → Workflow
1. Criar orçamento com pacote selecionado
2. Alterar status para "fechado"
3. Verificar se item aparece no Workflow com dados corretos

### Teste 3: Alteração de Pacote no Workflow
1. Abrir Workflow com item existente
2. Alterar pacote usando combobox
3. Verificar se categoria e valores são atualizados automaticamente

### Teste 4: Produtos Incluídos
1. Criar pacote com produtos incluídos
2. Usar pacote em agendamento/orçamento
3. Verificar se produto aparece no Workflow

## Debugging

### Logs para Verificar:
- `console.log` em `useOrcamentoData` mostra dados mapeados
- Verificar localStorage: `configuracoes_pacotes`, `configuracoes_categorias`, `configuracoes_produtos`
- Monitorar updates no `workflowItems` do AppContext

### Possíveis Problemas:
1. **Categoria não aparece**: Verificar se `categoria_id` do pacote corresponde ao `id` da categoria
2. **Valores incorretos**: Verificar mapeamento de `valor_base` vs `valorVenda` vs `valor`
3. **Produto não aparece**: Verificar se `produtosIncluidos` tem estrutura correta