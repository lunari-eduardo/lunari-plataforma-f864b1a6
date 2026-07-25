/**
 * AssistenteMcpTokens — v0.4 (OAuth 2.1 nativo + PAT como fallback).
 *
 * Duas superfícies de conexão:
 *  1) OAuth — clientes MCP (ChatGPT, Claude, Cursor) descobrem sozinhos e
 *     usam "Sign in with Lunari". Aparecem como "aplicativos conectados".
 *  2) PAT — token Bearer estático (`lmcp_...`) pra n8n, scripts, CLI.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Copy,
  Plus,
  Trash2,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Plug,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAssistantAccess } from "@/modules/assistant/runtime/useAssistantAccess";

interface TokenRow {
  id: string;
  name: string;
  token_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

interface OAuthAppRow {
  id: string;
  client_id: string;
  client_name: string;
  scopes: string[];
  approved_at: string | null;
  last_used_at: string | null;
}

const MCP_URL =
  "https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/assistant-mcp";

export default function AssistenteMcpTokens() {
  const { allowed: assistantAllowed, isLoading: accessLoading } = useAssistantAccess();
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [oauthApps, setOauthApps] = useState<OAuthAppRow[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [loadingApps, setLoadingApps] = useState(true);
  const [name, setName] = useState("");
  const [allowWrite, setAllowWrite] = useState(false);
  const [creating, setCreating] = useState(false);
  const [freshToken, setFreshToken] = useState<string | null>(null);

  const loadTokens = useCallback(async () => {
    setLoadingTokens(true);
    const { data, error } = await supabase
      .from("assistant_mcp_tokens")
      .select("id,name,token_prefix,scopes,last_used_at,expires_at,created_at")
      .is("revoked_at", null)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setTokens((data ?? []) as TokenRow[]);
    setLoadingTokens(false);
  }, []);

  const loadApps = useCallback(async () => {
    setLoadingApps(true);
    const { data, error } = await (supabase.rpc as any)("assistant_oauth_apps_list");
    if (error) {
      // RPC pode falhar silenciosamente se o OAuth Server ainda não estiver totalmente ativo.
      setOauthApps([]);
    } else {
      setOauthApps((data ?? []) as OAuthAppRow[]);
    }
    setLoadingApps(false);
  }, []);

  useEffect(() => {
    loadTokens();
    loadApps();
  }, [loadTokens, loadApps]);

  async function createToken() {
    if (!name.trim()) return toast.error("Dê um nome ao token (ex.: 'n8n produção').");
    setCreating(true);
    const scopes = allowWrite ? ["read", "write"] : ["read"];
    const { data, error } = await (supabase.rpc as any)("assistant_mcp_token_create", {
      _name: name.trim(),
      _expires_at: null,
      _scopes: scopes,
    });
    setCreating(false);
    if (error) return toast.error(error.message);
    const row = Array.isArray(data) ? data[0] : (data as any);
    if (!row?.token) return toast.error("Token não retornado.");
    setFreshToken(row.token);
    setName("");
    setAllowWrite(false);
    loadTokens();
  }

  async function revokeToken(id: string) {
    const { error } = await supabase
      .from("assistant_mcp_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    loadTokens();
  }

  async function revokeApp(id: string) {
    const { error } = await (supabase.rpc as any)("assistant_oauth_app_revoke", {
      _authorization_id: id,
    });
    if (error) return toast.error(error.message);
    loadApps();
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copiado.");
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <KeyRound className="h-6 w-6" /> Assistente Lu — MCP
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Conecte assistentes externos (ChatGPT, Claude, Cursor, n8n) às ferramentas do Lunari.
          A forma preferida é OAuth ("Sign in with Lunari"). Tokens estáticos ficam disponíveis
          para automações headless.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Endpoint do servidor MCP
            {!accessLoading && (
              <span
                className={`ml-auto text-[10px] px-1.5 py-0.5 rounded border ${
                  assistantAllowed
                    ? "border-emerald-500/50 text-emerald-700 dark:text-emerald-300"
                    : "border-amber-500/50 text-amber-700 dark:text-amber-300"
                }`}
              >
                {assistantAllowed ? "Lu liberada" : "Aguardando rollout"}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Input readOnly value={MCP_URL} className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={() => copy(MCP_URL)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Transporte: <strong>Streamable HTTP</strong>. Clientes MCP modernos descobrem o
            fluxo OAuth sozinhos via <code>/.well-known/oauth-protected-resource</code>.
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="oauth" className="w-full">
        <TabsList>
          <TabsTrigger value="oauth" className="gap-2">
            <Plug className="h-4 w-4" /> Aplicativos conectados
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary">
              recomendado
            </span>
          </TabsTrigger>
          <TabsTrigger value="pat" className="gap-2">
            <KeyRound className="h-4 w-4" /> Tokens pessoais
          </TabsTrigger>
        </TabsList>

        {/* ============ OAUTH APPS ============ */}
        <TabsContent value="oauth" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Como conectar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ol className="list-decimal pl-4 space-y-2 text-muted-foreground">
                <li>
                  No ChatGPT (Developer Mode) → <strong>Settings → Connectors → New</strong>. No
                  Claude Desktop / Cursor: adicione um MCP server remoto.
                </li>
                <li>
                  Cole a URL do endpoint acima. Escolha o modo <strong>OAuth</strong>. Não é
                  preciso informar URLs de authorize/token: o cliente descobre sozinho.
                </li>
                <li>
                  Você será redirecionado ao Lunari, fará login (se ainda não estiver) e verá
                  a tela de consentimento com as permissões que o app quer.
                </li>
                <li>Aprovado, o cliente ganha um token e passa a listar suas tools.</li>
              </ol>
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                Não vê o toggle "OAuth" no seu cliente MCP? Ele ainda está no modo antigo — use
                a aba <em>Tokens pessoais</em> como alternativa.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Aplicativos autorizados</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingApps ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
                </p>
              ) : oauthApps.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum app conectado ainda. Ao conectar via ChatGPT/Claude, ele aparece aqui.
                </p>
              ) : (
                <div className="divide-y">
                  {oauthApps.map((app) => (
                    <div key={app.id} className="flex items-center justify-between py-3">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">{app.client_name}</div>
                        <div className="text-xs text-muted-foreground">
                          Escopos: {app.scopes?.length ? app.scopes.join(", ") : "read"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {app.approved_at && (
                            <>Autorizado em {new Date(app.approved_at).toLocaleString("pt-BR")}</>
                          )}
                          {app.last_used_at && (
                            <> · Última atividade {new Date(app.last_used_at).toLocaleString("pt-BR")}</>
                          )}
                        </div>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            Revogar
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revogar acesso de "{app.client_name}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              O aplicativo perderá o acesso imediatamente. Ele poderá pedir uma
                              nova autorização, que você aprova ou nega.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => revokeApp(app.id)}>
                              Revogar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ PAT TOKENS ============ */}
        <TabsContent value="pat" className="space-y-4 mt-4">
          <Collapsible defaultOpen={tokens.length > 0 || !!freshToken}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                  <CardTitle className="text-base flex items-center gap-2">
                    Criar novo token
                    <ChevronDown className="h-4 w-4 ml-auto" />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Use tokens Bearer estáticos apenas em automações headless (n8n, scripts, CLI).
                    Para ChatGPT/Claude prefira OAuth.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nome (ex.: 'n8n produção')"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={creating}
                    />
                    <Button onClick={createToken} disabled={creating || !name.trim()}>
                      <Plus className="h-4 w-4 mr-2" /> Gerar
                    </Button>
                  </div>
                  <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={allowWrite}
                      onChange={(e) => setAllowWrite(e.target.checked)}
                      disabled={creating}
                    />
                    <span>
                      Permitir escrita. Ações destrutivas ainda exigem sua aprovação em{" "}
                      <a href="/app/assistente/aprovacoes" className="underline">
                        /assistente/aprovacoes
                      </a>
                      .
                    </span>
                  </label>
                  {freshToken && (
                    <div className="rounded-md border border-amber-500/50 bg-amber-50/40 dark:bg-amber-950/20 p-3 space-y-2">
                      <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                        Copie o token agora — ele não será exibido novamente.
                      </p>
                      <div className="flex items-center gap-2">
                        <Input readOnly value={freshToken} className="font-mono text-xs" />
                        <Button variant="outline" size="icon" onClick={() => copy(freshToken)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[11px] text-amber-800/80 dark:text-amber-200/80">
                          Header <code>Authorization</code> pronto pra colar:
                        </p>
                        <div className="flex items-center gap-2">
                          <Input
                            readOnly
                            value={`Bearer ${freshToken}`}
                            className="font-mono text-xs"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => copy(`Bearer ${freshToken}`)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setFreshToken(null)}>
                        Já copiei
                      </Button>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tokens ativos</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingTokens ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : tokens.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum token ativo.</p>
              ) : (
                <div className="divide-y">
                  {tokens.map((t) => (
                    <div key={t.id} className="flex items-center justify-between py-3">
                      <div className="space-y-1">
                        <div className="text-sm font-medium flex items-center gap-2">
                          {t.name}
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded border ${
                              t.scopes?.includes("write")
                                ? "border-amber-500/50 text-amber-700 dark:text-amber-300"
                                : "border-muted-foreground/30 text-muted-foreground"
                            }`}
                          >
                            {t.scopes?.includes("write") ? "read + write" : "read"}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {t.token_prefix}…
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Criado em {new Date(t.created_at).toLocaleString("pt-BR")}
                          {t.last_used_at && (
                            <> · Último uso {new Date(t.last_used_at).toLocaleString("pt-BR")}</>
                          )}
                        </div>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revogar token "{t.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Clientes usando este token perderão acesso imediatamente. Não pode
                              ser desfeito.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => revokeToken(t.id)}>
                              Revogar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
