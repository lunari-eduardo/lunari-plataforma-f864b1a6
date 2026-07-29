/**
 * AssistenteAprovacoes — Onda F.3
 *
 * Fila de aprovações assíncronas para tools destrutivas invocadas via MCP
 * externo (Claude/ChatGPT/Cursor). O fotógrafo aprova ou nega; ao aprovar,
 * recebe um `approval_token` de uso único que deve ser passado de volta ao
 * assistente para reexecutar a chamada.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, ShieldAlert, Check, X, RefreshCw } from "lucide-react";

interface ApprovalRow {
  id: string;
  tool_name: string;
  tool_args: Record<string, unknown>;
  summary: string | null;
  status: "pending" | "approved" | "denied" | "expired" | "consumed";
  requested_at: string;
  expires_at: string;
}

export default function AssistenteAprovacoes() {
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [freshTokens, setFreshTokens] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("assistant_approvals")
      .select("id,tool_name,tool_args,summary,status,requested_at,expires_at")
      .order("requested_at", { ascending: false })
      .limit(50);
    if (error) toast.error(error.message);
    else setRows((data ?? []) as ApprovalRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("assistant_approvals_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "assistant_approvals" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function decide(id: string, approve: boolean) {
    const { data, error } = await supabase.rpc("assistant_approval_decide", { _id: id, _approve: approve });
    if (error) return toast.error(error.message);
    const row = Array.isArray(data) ? data[0] : (data as any);
    if (approve && row?.approval_token_hash?.startsWith?.("lapr_")) {
      setFreshTokens((prev) => ({ ...prev, [id]: row.approval_token_hash }));
      toast.success("Aprovado. Copie o token e envie ao assistente.");
    } else if (!approve) {
      toast.success("Pedido negado.");
    }
    load();
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copiado.");
  }

  const pending = rows.filter((r) => r.status === "pending");
  const other = rows.filter((r) => r.status !== "pending");

  return (
    <div className="max-w-6xl mx-auto w-full px-4 md:px-6 py-4 space-y-6">
      <header className="flex items-start justify-between gap-4 pb-4">
        <div className="min-w-0 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          <div>
            <h1 className="font-heading text-[15px] font-semibold tracking-tight text-foreground">
              Aprovações da Lu (MCP)
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Ações destrutivas de assistentes externos. Cada aprovação gera um token de uso único (15 min).
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-2 ${loading ? "animate-spin" : ""}`} /> Recarregar
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pendentes ({pending.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pedido pendente.</p>
          ) : (
            pending.map((r) => (
              <div key={r.id} className="rounded-md border p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-mono text-xs text-muted-foreground">{r.tool_name}</div>
                    <div className="text-sm font-medium">{r.summary ?? "Ação sem resumo"}</div>
                    <div className="text-xs text-muted-foreground">
                      Pedido em {new Date(r.requested_at).toLocaleString("pt-BR")} · expira{" "}
                      {new Date(r.expires_at).toLocaleTimeString("pt-BR")}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => decide(r.id, false)}>
                      <X className="h-4 w-4 mr-1" /> Negar
                    </Button>
                    <Button size="sm" onClick={() => decide(r.id, true)}>
                      <Check className="h-4 w-4 mr-1" /> Aprovar
                    </Button>
                  </div>
                </div>
                <pre className="text-xs bg-muted/40 rounded p-2 overflow-auto max-h-40">
                  {JSON.stringify(r.tool_args, null, 2)}
                </pre>
                {freshTokens[r.id] && (
                  <div className="rounded-md border border-amber-500/50 bg-amber-50/40 dark:bg-amber-950/20 p-2 space-y-1">
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                      Token de uso único — copie e envie ao assistente como argumento <code>approval_token</code>.
                    </p>
                    <div className="flex items-center gap-2">
                      <Input readOnly value={freshTokens[r.id]} className="font-mono text-xs" />
                      <Button variant="outline" size="icon" onClick={() => copy(freshTokens[r.id])}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          {other.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nada por aqui ainda.</p>
          ) : (
            <div className="divide-y">
              {other.map((r) => (
                <div key={r.id} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="text-sm">{r.summary ?? r.tool_name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{r.tool_name}</div>
                  </div>
                  <Badge variant={r.status === "consumed" ? "default" : r.status === "denied" ? "destructive" : "secondary"}>
                    {r.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
