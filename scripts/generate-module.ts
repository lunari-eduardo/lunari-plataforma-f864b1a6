#!/usr/bin/env bun
/**
 * Scaffold para novos módulos Lunari.
 * Uso: bun run scripts/generate-module.ts <nome-do-modulo>
 *
 * Cria a estrutura padrão definida em docs/ARCHITECTURE.md.
 */
import { mkdir, writeFile, access } from "node:fs/promises";
import { join } from "node:path";

const name = process.argv[2];
if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error("Uso: bun run scripts/generate-module.ts <nome-kebab>");
  process.exit(1);
}

const root = join("src", "modules", name);

const dirs = [
  "domain/entities",
  "domain/value-objects",
  "domain/services",
  "application/use-cases/commands",
  "application/use-cases/queries",
  "application/policies",
  "application/events",
  "application/validators",
  "ports",
  "infrastructure/repos",
  "infrastructure/realtime",
  "infrastructure/adapters",
  "infrastructure/mappers",
  "presentation/hooks",
  "presentation/store",
  "presentation/components",
  "presentation/pages",
  "ai",
  "server",
  "tests/unit",
  "tests/use-case",
  "tests/integration",
  "tests/e2e",
  "docs",
];

const files: Record<string, string> = {
  "domain/errors.ts": `export type ${cap(name)}Error =
  | { code: "${name.toUpperCase()}_NOT_FOUND"; message: string };
`,
  "application/manifest.ts": `import type { Capability } from "@/shared/capability";

/**
 * Registry de capabilities do módulo "${name}".
 * Adicione aqui cada command/query exportado em application/use-cases.
 */
export const ${camel(name)}Capabilities: Capability[] = [];
`,
  "ports/index.ts": `// Declare aqui as interfaces de I/O do módulo "${name}".
// Implementações vão em infrastructure/.
export {};
`,
  "ai/tools.ts": `import { capabilityToAITool } from "@/shared/capability";
import { ${camel(name)}Capabilities } from "../application/manifest";

export const ${camel(name)}AITools = ${camel(name)}Capabilities.map(capabilityToAITool);
`,
  "index.ts": `// API pública do módulo "${name}".
// Só exporte daqui o que pode ser consumido de FORA do módulo.
export { ${camel(name)}Capabilities } from "./application/manifest";
`,
  "docs/MODULE.md": `# ${cap(name)} — MODULE.md

> Preencha seguindo docs/MODULE_TEMPLATE.md.

---
module: ${name}
version: 0.1.0
owners: []
status: draft
---

## 1. Objetivo do módulo
TODO.
`,
  "docs/CHANGELOG.md": `# Changelog — ${name}\n\n## [Unreleased]\n- Módulo criado via scaffold.\n`,
};

function cap(s: string) {
  return s.replace(/(^|-)(\w)/g, (_, _d, c) => c.toUpperCase());
}
function camel(s: string) {
  const c = cap(s);
  return c.charAt(0).toLowerCase() + c.slice(1);
}

async function exists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

if (await exists(root)) {
  console.error(`Módulo já existe: ${root}`);
  process.exit(1);
}

for (const d of dirs) {
  await mkdir(join(root, d), { recursive: true });
  await writeFile(join(root, d, ".gitkeep"), "");
}

for (const [rel, content] of Object.entries(files)) {
  await writeFile(join(root, rel), content);
}

console.log(`✓ Módulo "${name}" criado em ${root}`);
console.log(`→ Próximo: preencher docs/MODULE.md e declarar a 1ª capability.`);
