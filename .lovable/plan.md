# Plano de Varredura e Correção: Contraste da Capa Editorial

## 1. Análise do Problema Atual
Atualmente, o sistema de contraste (`useSeamContrast.ts`) decide a cor do texto sobre a fotografia baseado exclusivamente na luminância da imagem. Se a imagem for clara (> 160 de luminância), ele retorna uma cor escura (#171513). Caso contrário, retorna branco (#FFFFFF).

No entanto, o **tema da galeria** (claro ou escuro) define a cor da parte do título que está fora da foto (na área de fundo). 
- **Tema Claro:** Fundo claro, Texto preto.
- **Tema Escuro:** Fundo escuro, Texto branco.

**O bug conceitual:** Se o usuário tem um tema claro (texto preto no fundo) e a foto também é clara, a parte do texto sobre a foto *deve* permanecer preta (ou ajustar para um cinza muito escuro) para manter a harmonia, mas o sistema de contraste precisa ser inteligente o suficiente para não inverter para branco se isso causar uma quebra visual ou falta de legibilidade no tema claro.

## 2. Cenários de Falha Identificados
- **Cenário A (Tema Claro + Foto Clara):** Fundo bege (#F7F4EE) com texto preto (#171513). Foto tem luminância alta. O algoritmo detecta luminância alta e seta `overlayColor` para preto. **Correto.**
- **Cenário B (Tema Claro + Foto Média/Escura):** Fundo bege com texto preto. Foto tem luminância baixa. O algoritmo detecta luminância baixa e seta `overlayColor` para branco. **Correto (Flip visual).**
- **Cenário C (Tema Claro + Foto com áreas mistas):** O algoritmo de amostragem (`useSeamContrast`) tira uma média da área de intersecção. Se a média for limítrofe, pode haver cintilação ou escolha errada.

## 3. Plano de Ação Detalhado

### 3.1 Refinamento da Lógica de Contraste (`useSeamContrast.ts`)
1.  **Parâmetro de Sensibilidade por Tema:** Introduzir o `isDark` (já presente mas pouco explorado) para ajustar os thresholds de luminância.
2.  **Cálculo de Proximidade:** Se o tema é claro e a luminância da foto é alta, forçar a cor do texto a ser a mesma do `baseColor` (preto), a menos que a foto seja *tão* clara que precise de um ajuste de peso (negrito ou sombra sutil, embora evitemos sombras para manter o look editorial).
3.  **Histerese de Contraste:** Adicionar uma margem de segurança para evitar que pequenas variações na imagem mudem drasticamente a cor do texto.

### 3.2 Sincronização de Cores no Orchestrator (`EditorialCover.tsx`)
1.  **Base Color Inteligente:** Garantir que `baseColor` e `overlayColor` conversem. Em temas claros, se a foto permitir, manter o texto preto em ambos os lados para uma estética "minimalista pura".
2.  **Fallback Visual:** Se o algoritmo falhar (ex: imagem não carrega), o fallback deve respeitar o tema (Tema Claro = Fallback Preto, Tema Escuro = Fallback Branco).

### 3.3 Verificação de Geometria de Amostragem
1.  **Precisão da Intersecção:** Validar se o `titleIntersectionRect` está calculando corretamente a área onde o texto realmente toca a foto no mobile (onde a costura é horizontal).
2.  **Padding de Segurança:** Amostrar uma área levemente maior que o texto para garantir que as extremidades das letras não fiquem ilegíveis.

## 4. Próximos Passos (Mapeamento Técnico)
- Modificar `src/components/deliver/covers/editorial/useSeamContrast.ts` para aceitar `baseColor` como referência.
- Atualizar logicamente os retornos de `titleColor` e `ctaColor` baseados na combinação `(luminance, isDark, baseColor)`.
- Testar exaustivamente com imagens "High-Key" (muito brancas) em temas claros.
