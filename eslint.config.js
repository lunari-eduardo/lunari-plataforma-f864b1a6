import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import importPlugin from "eslint-plugin-import";
import tseslint from "typescript-eslint";

/**
 * Boundaries (Onda 3 — ADR-013)
 * Fase 1: WARNINGS por 2 semanas. Fase 2 (flip flag): erros no CI.
 *
 * Regras arquiteturais aplicadas via `import/no-restricted-paths`:
 *
 *  - Interfaces (`src/pages/**`, `src/components/**`) NÃO podem importar
 *    diretamente `src/modules/*​/infrastructure/**` nem `supabase/**` bruto.
 *    Devem passar pelo Kernel (`@/shared/kernel`) ou por capabilities/hooks
 *    expostos em `src/modules/*​/presentation/**` e `src/modules/*​/index.ts`.
 *
 *  - Domain (`src/modules/*​/domain/**`) é puro: não pode tocar React,
 *    infraestrutura, Supabase, nem outros módulos.
 *
 *  - Ports (`src/modules/*​/ports/**`) só definem contratos: nada de React,
 *    infra ou Supabase.
 *
 *  - Infrastructure (`src/modules/*​/infrastructure/**`) não pode importar UI
 *    (React, componentes, páginas).
 *
 *  - AI Gateway impl (`src/shared/ai/**`) não pode importar Kernel nem
 *    domínio direto — deve receber tudo por Port/registro.
 *
 * Excepcões pontuais devem usar `// eslint-disable-next-line import/no-restricted-paths`
 * com JUSTIFICATIVA (isso é dívida rastreada — ADR-013).
 */
const BOUNDARY_SEVERITY = "warn"; // Fase 1. Trocar para "error" na Fase 2.

const restrictedPaths = {
  zones: [
    // Interfaces (pages/components) NÃO tocam infra/supabase diretamente.
    {
      target: "./src/pages",
      from: "./src/modules/*/infrastructure",
      message:
        "Interfaces devem usar capabilities via Kernel (@/shared/kernel) ou presentation hooks, não infra direta.",
    },
    {
      target: "./src/components",
      from: "./src/modules/*/infrastructure",
      message:
        "Components não podem importar infrastructure de módulos. Use capability/hook exposto em presentation.",
    },
    {
      target: "./src/pages",
      from: "./src/integrations/supabase",
      message:
        "Pages não devem usar o cliente Supabase direto. Passe pelo Kernel/capability.",
    },
    {
      target: "./src/components",
      from: "./src/integrations/supabase",
      message:
        "Components não devem usar o cliente Supabase direto. Passe pelo Kernel/capability.",
    },

    // Domain é puro.
    {
      target: "./src/modules/*/domain",
      from: "./src/modules/*/infrastructure",
      message: "Domain não pode depender de infrastructure (ADR-013).",
    },
    {
      target: "./src/modules/*/domain",
      from: "./src/modules/*/presentation",
      message: "Domain não pode depender de presentation.",
    },
    {
      target: "./src/modules/*/domain",
      from: "./src/integrations/supabase",
      message: "Domain não pode importar Supabase (é puro).",
    },
    {
      target: "./src/modules/*/domain",
      from: "./src/components",
      message: "Domain não pode importar React/components.",
    },

    // Ports só declaram contratos.
    {
      target: "./src/modules/*/ports",
      from: "./src/modules/*/infrastructure",
      message: "Ports não podem importar implementação (infra).",
    },
    {
      target: "./src/modules/*/ports",
      from: "./src/integrations/supabase",
      message: "Ports não devem importar Supabase.",
    },

    // Infrastructure não toca UI.
    {
      target: "./src/modules/*/infrastructure",
      from: "./src/components",
      message: "Infrastructure não pode importar UI.",
    },
    {
      target: "./src/modules/*/infrastructure",
      from: "./src/pages",
      message: "Infrastructure não pode importar páginas.",
    },

    // AI Gateway impl é Port de infraestrutura (ADR-007) — não conhece Kernel/Domain.
    {
      target: "./src/shared/ai",
      from: "./src/shared/kernel",
      message:
        "AI Gateway não pode importar Kernel diretamente (ADR-007). Use registro/callbacks.",
    },
    {
      target: "./src/shared/ai",
      from: "./src/modules/*/domain",
      message: "AI Gateway não pode importar domínio direto (ADR-007).",
    },
  ],
};

export default tseslint.config(
  { ignores: ["dist", "supabase/functions/**", "scripts/**"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      import: importPlugin,
    },
    settings: {
      "import/resolver": {
        typescript: { alwaysTryTypes: true },
        node: { extensions: [".js", ".jsx", ".ts", ".tsx"] },
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
      "import/no-restricted-paths": [BOUNDARY_SEVERITY, restrictedPaths],
    },
  }
);
