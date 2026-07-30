/**
 * HubAtividade — audit visual das invocações do Assistente Lu.
 * Onda 5 (ADR-019). Somente leitura.
 */
import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Activity } from "lucide-react";

interface Row {
  id: string;
  ts: string;
  capability_id: string;
  module: string;
  kind: string;
  actor: string;
  auth_source: string | null;
  output_status: string;
  latency_ms: number | null;
  needs_approval: boolean;
  error_message: string | null;
  /** A5 — de onde veio a chamada e o que ela pedia. */
  surface: string | null;
  tool_name: string | null;
  client_id: string | null;
  required_tier: string | null;
}

export default function HubAtividade() {
  const { user } = useAuth();
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  // A5 — filtros de leitura do log (inclui chamadas negadas/bloqueadas).
  const [surfaceFilter, setSurfaceFilter] = React.useState<"all" | "app" | "mcp">("all");
  const [resultFilter, setResultFilter] = React.useState<"all" | "ok" | "problem">("all");

  const load = React.useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("assistant_invocations")
      .select("id,ts,capability_id,module,kind,actor,auth_source,output_status,latency_ms,needs_approval,error_message,surface,tool_name,client_id,required_tier")
      .eq("user_id", user.id)
      .order("ts", { ascending: false })
      .limit(100);
    if (!error && data) setRows(data as Row[]);
    setLoading(false);
  }, [user?.id]);

  React.useEffect(() => { load(); }, [load]);

  const visible = React.useMemo(() => {
    return rows.filter((r) => {
      const surface = r.surface ?? (r.auth_source ? "mcp" : "app");
      if (surfaceFilter !== "all" && surface !== surfaceFilter) return false;
      const isOk = r.output_status === "ok" || r.output_status === "ok_approved";
      if (resultFilter === "ok" && !isOk) return false;
      if (resultFilter === "problem" && isOk) return false;
      return true;
    });
  }, [rows, surfaceFilter, resultFilter]);

  const problems = rows.filter(
    (r) => r.output_status !== "ok" && r.output_status !== "ok_approved",
  ).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity size={14} className="text-primary" />
            Atividade do Assistente
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Últimas 100 invocações, incluindo negadas e bloqueadas
            {problems > 0 ? ` · ${problems} com problema` : ""}.
          </p>
        </div>
        <div className="flex items-center gap-1">
          {(["all", "app", "mcp"] as const).map((v) => (
            <Button
              key={v}
              variant={surfaceFilter === v ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-2xs"
              onClick={() => setSurfaceFilter(v)}
            >
              {v === "all" ? "Tudo" : v === "app" ? "App" : "MCP"}
            </Button>
          ))}
          {(["all", "ok", "problem"] as const).map((v) => (
            <Button
              key={v}
              variant={resultFilter === v ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-2xs"
              onClick={() => setResultFilter(v)}
            >
              {v === "all" ? "Todos" : v === "ok" ? "OK" : "Problemas"}
            </Button>
          ))}
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">Carregando…</p>
        ) : visible.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma invocação registrada ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground border-b border-border/60">
                <tr className="text-left">
                  <th className="py-2 pr-3 font-normal">Quando</th>
                  <th className="py-2 pr-3 font-normal">Capability</th>
                  <th className="py-2 pr-3 font-normal">Tipo</th>
                  <th className="py-2 pr-3 font-normal">Origem</th>
                  <th className="py-2 pr-3 font-normal">Resultado</th>
                  <th className="py-2 pr-3 font-normal text-right">ms</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {visible.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                      {new Date(r.ts).toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2 pr-3 font-mono text-foreground">{r.capability_id}</td>
                    <td className="py-2 pr-3">
                      <Badge variant="secondary" className="text-2xs">{r.kind}</Badge>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      <div>{r.surface === "mcp" ? (r.client_id ?? r.auth_source ?? "mcp") : "app"}</div>
                      {r.required_tier && (
                        <div className="text-2xs opacity-70">{r.required_tier}</div>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge
                        variant={
                          r.output_status === "ok" || r.output_status === "ok_approved"
                            ? "default"
                            : r.output_status === "pending_approval"
                              ? "outline"
                              : "destructive"
                        }
                        className="text-2xs"
                      >
                        {r.output_status}
                      </Badge>
                      {r.needs_approval && (
                        <Badge variant="outline" className="text-2xs ml-1">aprovação</Badge>
                      )}
                      {r.error_message && (
                        <div className="text-2xs text-destructive mt-0.5 truncate max-w-[280px]" title={r.error_message}>
                          {r.error_message}
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right text-muted-foreground">
                      {r.latency_ms ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
