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
}

export default function HubAtividade() {
  const { user } = useAuth();
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("assistant_invocations")
      .select("id,ts,capability_id,module,kind,actor,auth_source,output_status,latency_ms,needs_approval,error_message")
      .eq("user_id", user.id)
      .order("ts", { ascending: false })
      .limit(100);
    if (!error && data) setRows(data as Row[]);
    setLoading(false);
  }, [user?.id]);

  React.useEffect(() => { load(); }, [load]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity size={14} className="text-primary" />
            Atividade do Assistente
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Últimas 100 invocações. Origem, resultado e latência.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </Button>
      </CardHeader>
      <CardContent>
        {loading && rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">Carregando…</p>
        ) : rows.length === 0 ? (
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
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                      {new Date(r.ts).toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2 pr-3 font-mono text-foreground">{r.capability_id}</td>
                    <td className="py-2 pr-3">
                      <Badge variant="secondary" className="text-2xs">{r.kind}</Badge>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {r.auth_source ?? r.actor}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge
                        variant={r.output_status === "ok" ? "default" : "destructive"}
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
