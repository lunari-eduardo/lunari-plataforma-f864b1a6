/**
 * Instrumentação de dev: loga toda resposta REST do Supabase > 20KB.
 * Zero impacto em prod (guardado por `import.meta.env.DEV`).
 *
 * Uso: importar UMA vez em `src/main.tsx`.
 * Alvo: caçar telas que sozinhas geram MBs no /rest/v1/ e priorizar
 * projeção estreita nelas.
 */
if (import.meta.env.DEV && typeof window !== "undefined") {
  const orig = window.fetch;
  window.fetch = async (...args) => {
    const res = await orig(...args);
    const url = typeof args[0] === "string" ? args[0] : (args[0] as Request).url;
    if (url.includes("/rest/v1/")) {
      const clone = res.clone();
      clone
        .text()
        .then((body) => {
          if (body.length > 20_000) {
            // eslint-disable-next-line no-console
            console.warn(
              `[egress] ${(body.length / 1024).toFixed(1)}KB  ${url.replace(/apikey=[^&]+/, "apikey=…")}`,
            );
          }
        })
        .catch(() => {
          /* ignore */
        });
    }
    return res;
  };
}

export {};
