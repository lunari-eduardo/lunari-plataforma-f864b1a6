
# Plano: Reestruturar Pagina de Integracoes com Visual Premium

## Visao Geral

Criar uma nova estrutura para a pagina de Integracoes seguindo o design de referencia fornecido:
- Duas abas principais: **Pagamentos** e **Google Calendar**
- Na aba Pagamentos: metodos ativos fixos no topo + cards de configuracao abaixo
- Visual premium com logotipos oficiais

---

## Estrutura Proposta

```text
+---------------------------------------------------------------+
|  Integracoes                                                  |
|  Gerencie suas integracoes                                    |
|                                                               |
|  [Pagamentos]  [Google Calendar]                              |
+---------------------------------------------------------------+
|                                                               |
|  = Metodos de Pagamento Ativos                                |
|  Selecione qual sera o metodo padrao para novas cobrancas     |
|                                                               |
|  +----------------------------------------------------------+ |
|  | (logo) PIX Manual          [Definir Padrao] [Editar] [X] | |
|  |        Eduardo Valmor Diehl                              | |
|  +----------------------------------------------------------+ |
|  | (logo) InfinitePay         [Definir Padrao] [Editar] [X] | |
|  |        @lisediehl                                        | |
|  +----------------------------------------------------------+ |
|  | (logo) Mercado Pago  [Padrao]               [Editar] [X] | |
|  |        ID: 3078306387                                    | |
|  +----------------------------------------------------------+ |
|                                                               |
|  [!] PIX Manual: Voce precisara confirmar manualmente...      |
|                                                               |
+---------------------------------------------------------------+
|                                                               |
|  MERCADO PAGO                                                 |
|  Receba pagamentos via PIX e Cartao                           |
|  +----------------------------------------------------------+ |
|  | (logo) Conta Conectada     [Configurar] [Desconectar]    | |
|  |        Conectado em 29/01/2026                           | |
|  |        [PIX] [Cartao ate 3x]                             | |
|  +----------------------------------------------------------+ |
|                                                               |
|  INFINITEPAY                                                  |
|  Receba pagamentos com confirmacao automatica                 |
|  +----------------------------------------------------------+ |
|  | (logo) @lisediehl - Ativo                    [Editar]    | |
|  |                                                          | |
|  |  [!] Quando as taxas da InfinitePay...                   | |
|  +----------------------------------------------------------+ |
|                                                               |
|  PIX MANUAL                                                   |
|  Receba pagamentos via PIX com confirmacao manual             |
|  +----------------------------------------------------------+ |
|  | (logo) Eduardo Valmor Diehl               [Editar]       | |
|  |        Telefone: 51998287948                             | |
|  +----------------------------------------------------------+ |
|                                                               |
+---------------------------------------------------------------+
```

---

## Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/assets/pix-logo.png` | Criar | Copiar logo PIX fornecido |
| `src/assets/infinitepay-logo.png` | Criar | Copiar logo InfinitePay fornecido |
| `src/assets/mercadopago-logo.png` | Criar | Copiar logo Mercado Pago fornecido |
| `src/components/preferencias/IntegracoesTab.tsx` | Modificar | Adicionar tabs Pagamentos/Calendar |
| `src/components/integracoes/PagamentosTab.tsx` | Criar | Nova aba de pagamentos |
| `src/components/integracoes/ActiveMethodsList.tsx` | Criar | Lista de metodos ativos no topo |
| `src/components/integracoes/ActiveMethodRow.tsx` | Criar | Row de metodo ativo |
| `src/components/integracoes/MercadoPagoCard.tsx` | Criar | Card de config MP |
| `src/components/integracoes/PixManualCard.tsx` | Criar | Card de config PIX Manual |
| `src/components/integracoes/InfinitePayCard.tsx` | Modificar | Atualizar visual |
| `src/hooks/useIntegracoes.ts` | Modificar | Adicionar suporte PIX Manual |

---

## Componentes Detalhados

### 1. ActiveMethodRow

Card horizontal para cada metodo ativo no topo:
- Logo oficial do provedor (32x32px)
- Nome do provedor + info secundaria
- Badge "Padrao" (se for o metodo padrao)
- Botoes: "Definir Padrao", "Editar" (icone lapis), "Desconectar" (icone power)

```text
+----------------------------------------------------------------+
| [Logo]  PIX Manual              [Definir Padrao] [Editar] [X]  |
|         Eduardo Valmor Diehl                                   |
+----------------------------------------------------------------+
```

### 2. ActiveMethodsList

Container com borda arredondada contendo:
- Header: "Metodos de Pagamento Ativos" + subtitulo
- Lista de ActiveMethodRow para cada metodo conectado
- Alert amarelo para PIX Manual (aviso de confirmacao manual)

### 3. Cards de Configuracao

Cada provedor tera um card expandido abaixo da lista ativa:

**Mercado Pago:**
- Status da conexao + data
- Badges de metodos habilitados (PIX, Cartao 3x)
- Botoes Configurar / Desconectar

**InfinitePay:**
- Handle atual + status
- Campo de edicao do handle
- Alert informativo sobre taxas

**PIX Manual:**
- Nome do titular + tipo/chave
- Formulario de edicao (tipo chave, chave, nome)

---

## Hook useIntegracoes - Novas Funcoes

```typescript
interface UseIntegracoesReturn {
  // ... existentes ...
  
  // PIX Manual
  pixManualStatus: 'conectado' | 'desconectado';
  pixManualData: { chavePix: string; tipoChave: string; nomeTitular: string } | null;
  savePixManual: (data: { chavePix: string; tipoChave: string; nomeTitular: string }) => Promise<void>;
  disconnectPixManual: () => Promise<void>;
  
  // Padrao
  provedorPadrao: ProvedorPagamento | null;
  setProvedorPadrao: (provedor: ProvedorPagamento) => Promise<void>;
}
```

---

## Visual Premium

### Cores e Estilo
- Cards com `bg-white/95 backdrop-blur-sm border border-border/50 rounded-xl shadow-sm`
- Hover suave nos botoes de acao
- Badges coloridos por status (verde = ativo, amarelo = padrao)
- Transicoes suaves (`transition-all duration-200`)

### Logotipos
- PIX: Logo teal oficial fornecido
- InfinitePay: Circulo gradiente verde/amarelo fornecido
- Mercado Pago: Icone de maos fornecido (azul)

### Espacamento
- Gap de 16px entre cards
- Padding de 16-24px interno
- Bordas arredondadas de 12px (rounded-xl)

---

## Fluxo de Interacao

1. **Definir Padrao**: Ao clicar, atualiza `is_default = true` no banco e `false` nos outros
2. **Editar**: Scroll suave para o card do provedor correspondente, ativa modo edicao
3. **Desconectar**: Confirma e remove/desativa a integracao

---

## Banco de Dados

Campos necessarios em `usuarios_integracoes`:
- `is_default: boolean` - indica se eh o provedor padrao (se nao existir, adicionar)
- `provedor: 'mercadopago' | 'infinitepay' | 'pix_manual'`
- `status: 'ativo' | 'inativo'`
- `dados_extras: { handle?, chavePix?, tipoChave?, nomeTitular? }`

---

## Resumo de Implementacao

1. **Copiar logos** para `src/assets/`
2. **Criar ActiveMethodsList** e **ActiveMethodRow** com visual premium
3. **Criar PagamentosTab** organizando lista ativa + cards de config
4. **Criar PixManualCard** para gerenciar chave PIX
5. **Modificar IntegracoesTab** para usar Tabs (Pagamentos | Google Calendar)
6. **Estender useIntegracoes** com suporte a PIX Manual e provedor padrao
7. **Atualizar cards existentes** (MP, InfinitePay) com novo visual

Resultado: Pagina de integracoes premium, organizada e funcional conforme design de referencia.
