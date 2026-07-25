/**
 * AssistenteMcpTokens — Onda F.2
 *
 * Gerenciamento de Personal Access Tokens (PATs) para o servidor MCP da Lu.
 * Cada token dá acesso somente-leitura ao subconjunto curado de tools do
 * `assistant-mcp` (ver whitelist em executor.ts).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Copy, Plus, Trash2, KeyRound, ShieldCheck, Sparkles } from "lucide-react";
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

const MCP_URL =
  "https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/assistant-mcp";

export default function AssistenteMcpTokens() {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [allowWrite, setAllowWrite] = useState(false);
  const [creating, setCreating] = useState(false);
  const [freshToken, setFreshToken] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("assistant_mcp_tokens")
      .select("id,name,token_prefix,scopes,last_used_at,expires_at,created_at")
      .is("revoked_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
    } else {
      setTokens((data ?? []) as TokenRow[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createToken() {
    if (!name.trim()) return toast.error("Dê um nome ao token (ex.: 'Claude Desktop').");
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
    load();
  }

  async function revoke(id: string) {
    const { error } = await supabase
      .from("assistant_mcp_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    load();
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
          Conecte assistentes externos (Claude, ChatGPT, Cursor) às suas ferramentas de leitura no
          Lunari. Cada token dá acesso apenas às tools curadas de consulta — mutações continuam
          exigindo você no app.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Endpoint do servidor MCP
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <Input readOnly value={MCP_URL} className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={() => copy(MCP_URL)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            No cliente MCP, use transporte "Streamable HTTP" e adicione o header{" "}
            <code>Authorization: Bearer &lt;seu token&gt;</code>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Criar novo token</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Nome (ex.: Claude Desktop)"
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
              Permitir escrita (criar clientes, tarefas, transações). Ações destrutivas ainda exigem
              sua aprovação individual em <a href="/assistente/aprovacoes" className="underline">/assistente/aprovacoes</a>.
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
              <Button variant="ghost" size="sm" onClick={() => setFreshToken(null)}>
                Já copiei
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tokens ativos</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
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
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${t.scopes?.includes("write") ? "border-amber-500/50 text-amber-700 dark:text-amber-300" : "border-muted-foreground/30 text-muted-foreground"}`}>
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
                          Clientes MCP usando este token perderão o acesso imediatamente. Esta ação
                          não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => revoke(t.id)}>Revogar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
