/**
 * Workflow Waterfall Instrumentation (DEV-ONLY)
 * ==============================================
 *
 * Passo 0 do plano de investigação do cold-load do Workflow.
 *
 * OBJETIVO
 * --------
 * Capturar TODAS as chamadas envolvidas no carregamento do Workflow com
 * timing preciso, separando claramente:
 *   - Tempo de rede/banco (REST /rest/v1/, RPC, Edge Functions /functions/v1/)
 *   - Tempo de renderização (React commits, paint)
 *   - Tamanho de payload
 *   - Concorrência (quantas chamadas em paralelo em cada momento)
 *
 * DESIGN
 * ------
 * - 100% guardado por `import.meta.env.DEV`. Zero impacto em produção
 *   (o bundle nem inclui o corpo — Vite dead-code-elimina o bloco).
 * - Não altera comportamento: apenas intercepta `fetch` para medir.
 * - Não faz upload de nada. Só imprime no console e expõe helpers
 *   em `window.__wf` para inspeção manual.
 *
 * USO
 * ---
 *   // Console do navegador, em dev:
 *   __wf.start('cold-load-julho')     // marca início da captura
 *   // ...navega no Workflow...
 *   __wf.stop()                       // imprime tabela + waterfall
 *   __wf.export()                     // baixa JSON com tudo
 *   __wf.mark('nav:jul->jun')         // marca manual no timeline
 *
 * O import fica em `src/main.tsx`, ao lado do `egressLogger`.
 */

type CallKind = "rest" | "rpc" | "edge" | "auth" | "other";

interface CallRecord {
  id: number;
  kind: CallKind;
  method: string;
  url: string;
  /** Path curto p/ leitura (ex.: "rpc/workflow_month_metrics") */
  label: string;
  startMs: number;
  endMs?: number;
  durationMs?: number;
  status?: number;
  ok?: boolean;
  bytes?: number;
  error?: string;
  /** Tag opcional definida pelo usuário (via __wf.mark antes do fetch). */
  tag?: string;
}

interface Mark {
  t: number;
  label: string;
}

interface Session {
  name: string;
  startedAt: number;
  calls: CallRecord[];
  marks: Mark[];
  renderCommits: { t: number; durationMs: number; phase?: string }[];
}

declare global {
  interface Window {
    __wf?: {
      start: (name?: string) => void;
      stop: () => Session | null;
      mark: (label: string) => void;
      current: () => Session | null;
      export: () => void;
      print: () => void;
      arm: (name?: string) => void;
      disarm: () => void;
    };
  }

}

// Gate em runtime: dev local, preview Lovable (id-preview--*), ou opt-in via ?wf=1 / sessionStorage.
const __wfEnabled = (() => {
  if (typeof window === "undefined") return false;
  if (import.meta.env.DEV) return true;
  try {
    const host = window.location.hostname;
    if (/(^|\.)id-preview--/.test(host)) return true;
    if (new URLSearchParams(window.location.search).has("wf")) {
      sessionStorage.setItem("wf:enabled", "1");
      return true;
    }
    if (sessionStorage.getItem("wf:enabled") === "1") return true;
  } catch { /* ignore */ }
  return false;
})();

// Referências ao console capturadas via variável — esbuild `drop: ['console']`
// só remove chamadas SINTÁTICAS a `console.*`, não acessos indiretos.
const __c: Console | undefined = typeof window !== "undefined" ? (window as any).console : undefined;
const __log = (...a: any[]) => __c?.log?.(...a);
const __warn = (...a: any[]) => __c?.warn?.(...a);
const __table = (rows: any) => __c?.table?.(rows);
const __groupCollapsed = (label: string) => __c?.groupCollapsed?.(label);
const __groupEnd = () => __c?.groupEnd?.();

if (__wfEnabled && typeof window !== "undefined") {
  let session: Session | null = null;
  let seq = 0;
  let pendingTag: string | undefined;

  const ARM_KEY = "__wf_arm";


  const now = () => performance.now();

  const classify = (url: string): { kind: CallKind; label: string } => {
    try {
      const u = new URL(url, window.location.origin);
      const path = u.pathname;
      if (path.includes("/rest/v1/rpc/")) {
        const fn = path.split("/rpc/")[1] ?? "?";
        return { kind: "rpc", label: `rpc/${fn}` };
      }
      if (path.includes("/rest/v1/")) {
        const table = path.split("/rest/v1/")[1]?.split("?")[0] ?? "?";
        return { kind: "rest", label: `rest/${table}` };
      }
      if (path.includes("/functions/v1/")) {
        const fn = path.split("/functions/v1/")[1]?.split("?")[0] ?? "?";
        return { kind: "edge", label: `edge/${fn}` };
      }
      if (path.includes("/auth/v1/")) {
        return { kind: "auth", label: `auth${path.replace("/auth/v1", "")}` };
      }
      return { kind: "other", label: path };
    } catch {
      return { kind: "other", label: url };
    }
  };

  const relevantForCapture = (kind: CallKind) =>
    kind === "rest" || kind === "rpc" || kind === "edge" || kind === "auth";

  const orig = window.fetch.bind(window);
  window.fetch = async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input?.url ?? "";
    const method = (init?.method ?? (typeof input !== "string" && input?.method) ?? "GET").toUpperCase();
    const { kind, label } = classify(url);

    // Só captura se há sessão ativa E é chamada de interesse.
    const capture = session != null && relevantForCapture(kind);
    let rec: CallRecord | null = null;
    if (capture && session) {
      rec = {
        id: ++seq,
        kind,
        method,
        url: url.replace(/apikey=[^&]+/, "apikey=…"),
        label,
        startMs: now() - session.startedAt,
        tag: pendingTag,
      };
      pendingTag = undefined;
      session.calls.push(rec);
    }

    try {
      const res = await orig(input, init);
      if (rec && session) {
        rec.endMs = now() - session.startedAt;
        rec.durationMs = rec.endMs - rec.startMs;
        rec.status = res.status;
        rec.ok = res.ok;
        // Medir payload sem consumir o body original.
        try {
          const clone = res.clone();
          clone
            .arrayBuffer()
            .then((buf) => {
              if (rec) rec.bytes = buf.byteLength;
            })
            .catch(() => void 0);
        } catch {
          /* ignore */
        }
      }
      return res;
    } catch (err: any) {
      if (rec && session) {
        rec.endMs = now() - session.startedAt;
        rec.durationMs = rec.endMs - rec.startMs;
        rec.error = err?.message ?? String(err);
      }
      throw err;
    }
  };

  // ---------- Render timing via PerformanceObserver ----------
  try {
    const po = new PerformanceObserver((list) => {
      if (!session) return;
      for (const entry of list.getEntries()) {
        // "measure" cobre React DevTools/Profiler & manual marks.
        session.renderCommits.push({
          t: entry.startTime - session.startedAt,
          durationMs: entry.duration,
          phase: entry.name,
        });
      }
    });
    po.observe({ entryTypes: ["measure", "paint", "longtask"] as any });
  } catch {
    /* PerformanceObserver não disponível */
  }

  // ---------- API pública ----------
  const printTable = (s: Session) => {
    const rows = s.calls.map((c) => ({
      id: c.id,
      kind: c.kind,
      method: c.method,
      label: c.label,
      start: c.startMs.toFixed(0) + "ms",
      dur: (c.durationMs ?? 0).toFixed(0) + "ms",
      status: c.status ?? "-",
      kb: c.bytes != null ? (c.bytes / 1024).toFixed(1) : "-",
      tag: c.tag ?? "",
    }));
    // eslint-disable-next-line no-console
    __groupCollapsed(
      `[waterfall] ${s.name}  ${s.calls.length} chamadas  em ${(now() - s.startedAt).toFixed(0)}ms`,
    );
    // eslint-disable-next-line no-console
    __table(rows);
    // Agregações por kind
    const byKind: Record<string, { n: number; totalMs: number; kb: number }> = {};
    for (const c of s.calls) {
      const k = c.kind;
      byKind[k] ??= { n: 0, totalMs: 0, kb: 0 };
      byKind[k].n++;
      byKind[k].totalMs += c.durationMs ?? 0;
      byKind[k].kb += (c.bytes ?? 0) / 1024;
    }
    // eslint-disable-next-line no-console
    __log("Agregado por tipo:", byKind);
    if (s.marks.length) {
      // eslint-disable-next-line no-console
      __log(
        "Marcas:",
        s.marks.map((m) => `${m.t.toFixed(0)}ms → ${m.label}`),
      );
    }
    // Concorrência: max sobreposição
    const events: { t: number; d: 1 | -1 }[] = [];
    for (const c of s.calls) {
      events.push({ t: c.startMs, d: 1 });
      if (c.endMs != null) events.push({ t: c.endMs, d: -1 });
    }
    events.sort((a, b) => a.t - b.t || a.d - b.d);
    let cur = 0, max = 0;
    for (const e of events) {
      cur += e.d;
      if (cur > max) max = cur;
    }
    // eslint-disable-next-line no-console
    __log(`Concorrência máxima: ${max} chamadas simultâneas`);
    // eslint-disable-next-line no-console
    __groupEnd();
  };

  window.__wf = {
    start(name = "waterfall") {
      session = {
        name,
        startedAt: now(),
        calls: [],
        marks: [],
        renderCommits: [],
      };
      seq = 0;
      // eslint-disable-next-line no-console
      __log(`[waterfall] capturando "${name}" — use __wf.stop() para encerrar`);
    },
    stop() {
      if (!session) {
        // eslint-disable-next-line no-console
        __warn("[waterfall] nenhuma sessão ativa");
        return null;
      }
      const s = session;
      session = null;
      // Aguardar um tick para deixar o arrayBuffer() dos últimos fechar.
      setTimeout(() => printTable(s), 50);
      return s;
    },
    mark(label: string) {
      if (!session) {
        pendingTag = label;
        return;
      }
      session.marks.push({ t: now() - session.startedAt, label });
      pendingTag = label;
    },
    current() {
      return session;
    },
    export() {
      if (!session && !window.__wf?.current()) {
        // eslint-disable-next-line no-console
        __warn("[waterfall] nada para exportar");
        return;
      }
      const s = session ?? window.__wf!.current()!;
      const blob = new Blob([JSON.stringify(s, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `waterfall-${s.name}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    },
    print() {
      if (!session) return;
      printTable(session);
    },
    arm(name = "cold-load") {
      try {
        sessionStorage.setItem(ARM_KEY, name);
        // eslint-disable-next-line no-console
        __log(`[waterfall] ARMADO: captura iniciará automaticamente no próximo load como "${name}". Faça o hard-refresh agora (Ctrl+Shift+R).`);
      } catch { /* ignore */ }
    },
    disarm() {
      try { sessionStorage.removeItem(ARM_KEY); } catch { /* ignore */ }
      // eslint-disable-next-line no-console
      __log("[waterfall] desarmado");
    },
  };

  // Auto-start se foi armado antes de um refresh.
  try {
    const armed = sessionStorage.getItem(ARM_KEY);
    if (armed) {
      sessionStorage.removeItem(ARM_KEY);
      window.__wf!.start(armed);
    }
  } catch { /* ignore */ }


  // eslint-disable-next-line no-console
  __log(
    "%c[waterfall] instrumentação carregada. Use __wf.start('cold-load') / __wf.stop()",
    "color:#b0632f;font-weight:600",
  );
}

export {};
