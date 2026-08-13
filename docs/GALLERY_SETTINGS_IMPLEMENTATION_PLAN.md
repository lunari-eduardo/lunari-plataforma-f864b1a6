# Refatoração da Página de Configurações da Lunari Gallery

Este plano detalha a reorganização da experiência e estrutura visual da página de configurações da Gallery, seguindo as diretrizes exigidas e garantindo a preservação das lógicas de negócio e banco de dados atuais.

## 1. Arquitetura atual

- **Componente atual da sidebar**: `src/components/layout/Sidebar.tsx`
- **Componente/layout que controla a Gallery**: O painel é gerenciado pelo `PhotographerApp.tsx` e o `Sidebar.tsx` que agrupa os itens da gallery.
- **Rota atual de configurações**: `/app/gallery/settings` (Definida no router principal ou componente correspondente).
- **Página atual de configurações**: `src/pages/gallery/GallerySettings.tsx`
- **Componentes filhos utilizados**: 
  - `src/components/settings/GeneralSettings.tsx` (que abriga regras misturadas).
  - `src/components/settings/PersonalizationSettings.tsx` (que abriga personalização e configurações misturadas de experiência).
- **Hooks utilizados**: `src/hooks/useSettings.ts` e `src/hooks/useGallerySettings.ts`.
- **Tabelas Supabase envolvidas**: `gallery_settings`.
- **Tipos/interfaces relacionados**: `GlobalSettings` em `src/types/gallery.ts`.
- **Funções de persistência**: `updateSettings` retornada pelo `useSettings`.

---

## 2. Mapeamento COMPLETO das configurações atuais

| Configuração atual | Arquivo/componente | Campo/estado | Persistência | Nova localização |
| ------------------ | ------------------ | ------------ | ------------ | ---------------- |
| Permissão Padrão de Galerias | `GeneralSettings.tsx` | `defaultGalleryPermission` | `updateSettings` (`gallery_settings`) | **Padrões > Geral** |
| Prazo Padrão (Expiração) | `GeneralSettings.tsx` | `defaultExpirationDays` | `updateSettings` (`gallery_settings`) | **Padrões > Geral** |
| Modo de Venda Padrão | `GeneralSettings.tsx` | `defaultSaleMode` | `updateSettings` (`gallery_settings`) | **Padrões > Vendas** |
| Tipo de Cobrança Padrão | `GeneralSettings.tsx` | `defaultChargeType` | `updateSettings` (`gallery_settings`) | **Padrões > Vendas** |
| Modelo de Preços Padrão | `GeneralSettings.tsx` | `defaultPricingModel` | `updateSettings` (`gallery_settings`) | **Padrões > Vendas** |
| Tamanho Padrão das Imagens | `GeneralSettings.tsx` | `defaultImageResize` | `updateSettings` (`gallery_settings`) | **Padrões > Imagens** |
| Permitir Comentários | `PersonalizationSettings.tsx` | `defaultAllowComments` | `updateSettings` (`gallery_settings`) | **Padrões > Seleção** |
| Permitir Download | `PersonalizationSettings.tsx` | `defaultAllowDownload` | `updateSettings` (`gallery_settings`) | **Padrões > Imagens** |
| Permitir Fotos Extras | `PersonalizationSettings.tsx` | `defaultAllowExtraPhotos` | `updateSettings` (`gallery_settings`) | **Padrões > Seleção** |
| Mensagem de Boas-vindas | `PersonalizationSettings.tsx` | `defaultWelcomeMessage` / `welcomeMessageEnabled` | `updateSettings` (`gallery_settings`) | **Personalização** |
| Fonte da Sessão | `PersonalizationSettings.tsx` | `lastSessionFont` | `updateSettings` (`gallery_settings`) | **Personalização** |
| Cores / Temas / Capas / Watermark / Emails | Diversos componentes (ex: `ThemeConfig`, `CoverConfig`, etc.) importados em `PersonalizationSettings.tsx` | `themeType`, `defaultWatermark`, `emailTemplates`, etc. | `updateSettings` e funções locais (`gallery_settings`) | **Personalização** |

> [!NOTE] 
> O campo `defaultAllowDownload` foi alocado em **Imagens** por tratar-se da disponibilização dos arquivos.
> Os campos `defaultAllowComments` e `defaultAllowExtraPhotos` foram alocados em **Seleção**, pois ditam como o cliente interage com a escolha/limite de fotos.

---

## 3. Plano da Sidebar

**Componente a ser alterado:** `src/components/layout/Sidebar.tsx`

**Estrutura Atual (para Gallery):**
```text
Início
Galerias
Configurações
Integrações
```

**Nova Estrutura Desejada:**
```text
Início
Galerias

CONFIGURAÇÕES (divisor não clicável)
Padrões
Personalização

Integrações (mantido separado)
```

**Implementação:**
- Remover o item genérico `{ to: "/app/gallery/settings", icon: <Settings size={14} />, label: "Configurações" }` da constante `galleryNavItems`.
- Criar um separador na renderização do menu (utilizando validação por tipo/label, se necessário, ou inserindo a sub-seção diretamente no array `galleryNavItems` com uma flag `isSection`).
- Adicionar os novos itens com suas respectivas rotas:
  - `{ to: "/app/gallery/settings/defaults", icon: <Settings2 size={14} />, label: "Padrões" }`
  - `{ to: "/app/gallery/settings/customization", icon: <Palette size={14} />, label: "Personalização" }`
- Manter o comportamento responsivo atual que varre `currentNavItems` (cuidado para filtrar itens puramente visuais como o divisor no menu Mobile).

---

## 4. Arquitetura da página "Padrões"

A arquitetura utilizará o conceito de **Tabs UI (Abas Horiizontais)** para não aumentar a complexidade das rotas do React Router sem necessidade, mas mantendo a organização de interface exigida.

**Página Principal Refatorada:** `src/pages/gallery/GallerySettings.tsx` deverá ser convertida no componente base para as sub-páginas, OU substituída por subrotas se acharmos mais adequado. A melhor opção aqui é utilizar subrotas para separar "Padrões" de "Personalização".
- `/app/gallery/settings/defaults` -> Monta o componente `GalleryDefaultsPage`.
- `/app/gallery/settings/customization` -> Monta o componente `PersonalizationSettings`.

Dentro de `GalleryDefaultsPage` (nova página de Padrões):
- **Tabs Horizontais**: 
  - Valor "geral" (Geral)
  - Valor "selecao" (Seleção)
  - Valor "vendas" (Vendas)
  - Valor "imagens" (Imagens)
- Isso será feito utilizando o componente `<Tabs>` já nativo do projeto (da lib Radix UI que está no projeto).

**Componentes que precisam ser refatorados:**
O atual `GeneralSettings.tsx` será **desmembrado**. Ele não deve mais existir da forma atual. Em seu lugar, criaremos fragmentos organizados:
- `src/components/settings/defaults/DefaultsGeneralTab.tsx`
- `src/components/settings/defaults/DefaultsSelectionTab.tsx`
- `src/components/settings/defaults/DefaultsSalesTab.tsx`
- `src/components/settings/defaults/DefaultsImagesTab.tsx`

---

## 5. Plano de cada aba (dentro de "Padrões")

### 5.1. Aba Geral (`DefaultsGeneralTab.tsx`)
**Acesso da galeria:**
- Reutilizar `defaultGalleryPermission` (Pública x Privada).
- Se a funcionalidade de "Senha padrão" existir (verificarei se existe no BD de galeria), alocar aqui.
**Prazo de expiração:**
- Utilizar `defaultExpirationDays` (Radio group ou input de dias).

### 5.2. Aba Seleção (`DefaultsSelectionTab.tsx`)
**Modo de seleção:**
- Renderizar as permissões: `defaultAllowComments`, `defaultAllowExtraPhotos`.
- (Nota: Limite de fotos padrão nas novas galerias atualmente depende do plano/criação manual. Se houver alguma outra regra padrão de quantidade máxima já existente no state global, ela entra aqui).

### 5.3. Aba Vendas (`DefaultsSalesTab.tsx`)
**Modo de venda:**
- Mover a configuração de `defaultSaleMode` (Não vender / Sim com pagamento / Sim sem pagamento).
**Tipo de cobrança:**
- Mover a configuração `defaultChargeType` (Cobrar apenas extras / Cobrar todas selecionadas).
**Modelo de preços:**
- Mover `defaultPricingModel` (Preço único / Pacotes progressivos).

### 5.4. Aba Imagens (`DefaultsImagesTab.tsx`)
**Tamanho padrão das imagens:**
- Mover `defaultImageResize` (1024 / 1920 / 2560 px).
**Opções de entrega/download:**
- Mover `defaultAllowDownload`.

---

## 6. Personalização

- A página atual `src/components/settings/PersonalizationSettings.tsx` deve ser mapeada para a rota `/app/gallery/settings/customization`.
- As configurações de "Permitir Comentários", "Download" e "Fotos Extras" que antes moravam no meio dessa página **SERÃO REMOVIDAS DAQUI** e movidas para as abas descritas no Ponto 5.
- A página "Personalização" se focará 100% em Identidade visual: Layouts, Cores, Tipografia, Mensagens de Boas-vindas, Textos, Marca d'água, Email Templates, Capas, etc. Tudo isso já está lá e não será desmanchado.

---

## 7. Persistência e backend

**NENHUMA ALTERAÇÃO DE BANCO SERÁ REALIZADA.**
A estrutura da tabela `gallery_settings` atende perfeitamente ao formato existente. Nomes de colunas, constraints, ou tipos permanecerão inalterados.

- **Hook:** `useSettings` (que chama `useGallerySettings`) continua responsável pela leitura/gravação.
- **Save behavior:** O botão/auto-save se manterá intacto, dependendo da interface (botão no footer ou onChange como nos RadioGroups atuais).

---

## 8. Compatibilidade

Como não estamos mudando a API, apenas as telas em que os *inputs* moram, a retrocompatibilidade está 100% garantida:
- Galerias antigas têm seus valores cravados na tabela `galleries` (o `gallery_settings` atua apenas no momento de criação de uma *NOVA* galeria).
- O fluxo de criação `GalleryCreate.tsx` que puxa esses padrões via query do hook continuará recebendo exatamente os mesmos objetos.

---

## 9. Design e componentes

- O design utilizará a largura que foi padronizada (`max-w-[79rem] mx-auto`) para bater com Finanças.
- **Reutilização:** Os blocos (cards brancos com bordas suaves, ícones ilustrativos e `RadioGroup`) usados atualmente no `GeneralSettings.tsx` serão **reaproveitados**, pois eles seguem 100% o Design System exigido na tarefa (cartões bem agrupados, ícones, descrições claras).
- A separação por abas será feita com o `<Tabs>` nativo do Radix que já está na UI.

---

## 10. Ordem de implementação

**Fase 1: Ajuste de Rotas e Sidebar**
- Alterar as definições de rotas (`src/App.tsx` / `GalleryApp.tsx`) para apontar para `defaults` e `customization`.
- Alterar o menu em `Sidebar.tsx` incluindo o divisor "CONFIGURAÇÕES".

**Fase 2: Desmembramento e criação da Página "Padrões"**
- Criar `GalleryDefaultsPage.tsx`.
- Instanciar as 4 tabs (`<TabsContent>`) vazias.

**Fase 3: Preenchimento das Abas**
- Migrar o conteúdo de "Acesso/Prazo" do antigo `GeneralSettings` para a aba Geral.
- Migrar configurações de limites originárias da Personalização para a aba Seleção.
- Migrar lógicas de preço e venda para Vendas.
- Migrar configurações de Resize e Download para Imagens.
- Excluir o arquivo antigo `GeneralSettings.tsx`.

**Fase 4: Limpeza da página Personalização**
- Remover da `PersonalizationSettings.tsx` os inputs que foram transpostos para a Aba Padrões.

**Fase 5: Revisão / Testes Locais**
- Testar salvamento em todas as abas para confirmar a ligação com `updateSettings`.

---

## 11. Estratégia de testes

- **Navegação**: Clicar na Sidebar em `Padrões` e ver se as Abas (Geral, Seleção, Vendas, Imagens) abrem. Clicar em `Personalização` e garantir o carregamento independente.
- **Persistência**: Alterar o Modo de Seleção (ex: permitir download) e fazer refresh da página para confirmar se recarrega o estado modificado.
- **Compatibilidade**: Iniciar fluxo "Nova Galeria" e verificar se ela herda os padrões salvos.
- **Responsividade**: Comprimir a tela e observar os Tabs do Radix (no mobile as abas usam scroll horizontal de forma amigável).

---

## 12. Critérios de aceite

1. Sidebar apresentará "CONFIGURAÇÕES" (como divisor) e as subpáginas "Padrões" e "Personalização".
2. A página "Padrões" terá 4 abas (Geral, Seleção, Vendas, Imagens).
3. Todas as configurações mapeadas da tabela 2 do plano foram relocalizadas em seus destinos corretos.
4. Nenhuma regra de negócio (backend, funções de salvar) foi alterada. Nenhuma tabela foi alterada.
5. As funcionalidades de personalização não-relacionadas a comportamentos continuam na aba Personalização.

---

## 13. Riscos e decisões pendentes

- **Risco**: Quebra de roteamento, dado que `/app/gallery/settings` precisará ser roteada de forma bifurcada ou usar `<Outlet />`.
  - **Decisão**: Ajustar a rota `/app/gallery/settings` para fazer um redirect imediato para `/app/gallery/settings/defaults`, de modo a não quebrar acessos diretos.

- **Risco**: O botão "Salvar Configurações" flutuante que existe no componente principal atual precisa abranger os novos subcomponentes de abas.
  - **Decisão**: Manter o uso do `onValueChange` que executa autosave (toast success) caso seja rádio button e utilizar o botão flutuante para campos de input manual (conforme a arquitetura atual de persistência). 
