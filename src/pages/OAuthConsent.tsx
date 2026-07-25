/**
 * OAuthConsent — tela pública de consentimento OAuth 2.1.
 *
 * Configurada no Supabase como Authorization Path (`/oauth/consent`).
 * Recebe `authorization_id` na querystring e usa o namespace beta
 * `supabase.auth.oauth` para aprovar/negar a autorização, redirecionando de
 * volta para o cliente (ChatGPT, Claude, etc.) ao final.
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  getAuthorizationDetails,
  approveAuthorization,
  denyAuthorization,
  type OAuthAuthorizationDetails,
} from "@/lib/supabaseOAuth";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, AlertTriangle, ArrowRight } from "lucide-react";
import lunariLogo from "@/assets/auth/lunari-studio-logo.png";

type ViewState =
  | { kind: "loading" }
  | { kind: "needs-login"; next: string }
  | { kind: "error"; message: string }
  | { kind: "ready"; details: OAuthAuthorizationDetails }
  | { kind: "deciding" }
  | { kind: "redirecting" };

const SCOPE_LABELS: Record<string, string> = {
  read: "Ler dados da sua conta (agenda, clientes, financeiro, galerias)",
  write:
    "Criar e editar registros (clientes, tarefas, pagamentos manuais) — ações destrutivas ainda pedem sua aprovação individual",
  openid: "Identificar você",
  email: "Ver seu e-mail",
  profile: "Ver dados básicos do seu perfil",
};

function humanizeScopes(details: OAuthAuthorizationDetails): string[] {
  const raw =
    details.scopes ??
    (typeof details.scope === "string" ? details.scope.split(/\s+/) : []);
  const list = raw.filter(Boolean);
  if (list.length === 0) return ["Acesso padrão à sua conta Lunari"];
  return list.map((s) => SCOPE_LABELS[s] ?? s);
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const nextPath = useMemo(
    () => window.location.pathname + window.location.search,
    []
  );
  const [state, setState] = useState<ViewState>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setState({ kind: "error", message: "Parâmetro authorization_id ausente." });
        return;
      }

      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        setState({ kind: "needs-login", next: nextPath });
        return;
      }

      const { data, error } = await getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setState({ kind: "error", message: error.message || "Falha ao carregar a autorização." });
        return;
      }
      if (!data) {
        setState({ kind: "error", message: "Autorização não encontrada ou expirada." });
        return;
      }
      // Alguns fluxos já vêm resolvidos (usuário previamente concedeu) — segue redirect direto.
      const immediateRedirect = data.redirect_url ?? data.redirect_to;
      if (immediateRedirect && !data.client) {
        setState({ kind: "redirecting" });
        window.location.replace(immediateRedirect);
        return;
      }
      setState({ kind: "ready", details: data });
    })();
    return () => {
      active = false;
    };
  }, [authorizationId, nextPath]);

  const [trace, setTrace] = useState<any>(null);

  async function decide(approve: boolean) {
    const t0 = Date.now();
    console.info("[oauth-consent] decide start", { approve, authorizationId, t0 });
    setState({ kind: "deciding" });
    const { data, error } = approve
      ? await approveAuthorization(authorizationId)
      : await denyAuthorization(authorizationId);
    const t1 = Date.now();
    const debug = (error as any)?.debug ?? null;
    console.info("[oauth-consent] decide result", {
      approve,
      authorizationId,
      elapsedMs: t1 - t0,
      data,
      errorMessage: error?.message,
      debug,
    });
    if (error) {
      setTrace({ phase: "approve/deny", error: error.message, debug });
      setState({ kind: "error", message: error.message || "Falha ao registrar decisão." });
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setTrace({ phase: "approve/deny", note: "sem redirect_url", data });
      setState({
        kind: "error",
        message: "Servidor OAuth não devolveu URL de retorno.",
      });
      return;
    }
    console.info("[oauth-consent] redirecting to", target);
    setTrace({ phase: "redirecting", target, data });
    setState({ kind: "redirecting" });
    window.location.replace(target);
  }

  return (
    <div className="min-h-[100dvh] w-full bg-[#0a0a0a] text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-6 md:p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <img src={lunariLogo} alt="Lunari" className="h-8 w-auto" />
          <div className="h-6 w-px bg-white/15" />
          <span className="text-xs uppercase tracking-wider text-white/60">
            Autorização de acesso
          </span>
        </div>

        {state.kind === "loading" && (
          <div className="flex items-center gap-2 text-white/70 text-sm py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando pedido…
          </div>
        )}

        {state.kind === "needs-login" && (
          <div className="space-y-4 text-center">
            <ShieldCheck className="h-10 w-10 text-[#C97A4A] mx-auto" />
            <h1 className="text-lg font-semibold">Entre pra continuar</h1>
            <p className="text-sm text-white/70">
              Você precisa estar logado no Lunari pra autorizar este aplicativo.
            </p>
            <Button
              className="w-full bg-[#C97A4A] hover:bg-[#B56A3E] text-white"
              onClick={() => {
                window.location.href = `/auth?next=${encodeURIComponent(state.next)}`;
              }}
            >
              Fazer login <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {state.kind === "error" && (
          <div className="space-y-3 text-center">
            <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto" />
            <h1 className="text-lg font-semibold">Não deu pra prosseguir</h1>
            <p className="text-sm text-white/70 break-words">{state.message}</p>
            <details className="text-left text-[11px] text-white/40 bg-white/[0.03] rounded p-2">
              <summary className="cursor-pointer">Detalhes técnicos</summary>
              <pre className="whitespace-pre-wrap break-all mt-1">
authorization_id: {authorizationId || "(ausente)"}
url: {typeof window !== "undefined" ? window.location.href : ""}
              </pre>
            </details>
            <Button
              variant="outline"
              className="border-white/20 bg-transparent hover:bg-white/5 text-white"
              onClick={() => (window.location.href = "/app")}
            >
              Voltar ao Lunari
            </Button>
          </div>
        )}

        {(state.kind === "ready" || state.kind === "deciding") && (
          <div className="space-y-5">
            <div>
              <h1 className="text-xl font-semibold leading-tight">
                Conectar{" "}
                <span className="text-[#C97A4A]">
                  {state.kind === "ready"
                    ? state.details.client?.client_name ??
                      state.details.client?.name ??
                      "aplicativo externo"
                    : "aplicativo"}
                </span>{" "}
                à sua conta?
              </h1>
              <p className="text-sm text-white/70 mt-2">
                Esse aplicativo poderá agir em seu nome usando as ferramentas do
                Assistente Lu.
              </p>
            </div>

            {state.kind === "ready" && (
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-wide text-white/50 mb-2">
                  Permissões solicitadas
                </p>
                <ul className="space-y-1.5 text-sm text-white/85">
                  {humanizeScopes(state.details).map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-[#C97A4A] mt-0.5">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-white/50">
              Você pode revogar o acesso a qualquer momento em{" "}
              <span className="text-white/70">Configurações → Integrações → Assistente</span>.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                disabled={state.kind === "deciding"}
                onClick={() => decide(false)}
                className="border-white/20 bg-transparent hover:bg-white/5 text-white"
              >
                Negar
              </Button>
              <Button
                disabled={state.kind === "deciding"}
                onClick={() => decide(true)}
                className="bg-[#C97A4A] hover:bg-[#B56A3E] text-white"
              >
                {state.kind === "deciding" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Autorizando…
                  </>
                ) : (
                  "Autorizar"
                )}
              </Button>
            </div>
          </div>
        )}

        {state.kind === "redirecting" && (
          <div className="flex items-center gap-2 text-white/70 text-sm py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Redirecionando de volta…
          </div>
        )}
      </div>
    </div>
  );
}
