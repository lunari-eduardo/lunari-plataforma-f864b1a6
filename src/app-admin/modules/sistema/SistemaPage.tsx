import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, Database, AlertTriangle } from "lucide-react";

type TableStat = {
  table_name: string;
  rows_read: number;
  rows_inserted: number;
  rows_updated: number;
  rows_deleted: number;
  live_rows: number;
  total_size_bytes: number;
  total_size_pretty: string;
};

function formatNumber(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

export default function SistemaPage() {
  const [stats, setStats] = useState<TableStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "admin-egress-stats",
        { body: {} },
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setStats(data?.tables ?? []);
      setLastFetch(new Date());
    } catch (err: any) {
      setError(err?.message ?? "Erro ao carregar estatísticas");
    } finally {
      setLoading(false);
    }
  };

  const totalRowsRead = stats.reduce((s, t) => s + Number(t.rows_read), 0);
  const totalSize = stats.reduce((s, t) => s + Number(t.total_size_bytes), 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sistema · Monitoramento</h1>
          <p className="text-sm text-muted-foreground">
            Proxy de egress por tabela. Use para identificar consumidores de
            banda no Supabase.
          </p>
        </div>
        <Button onClick={fetchStats} disabled={loading} size="sm">
          <RefreshCw
            className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          {loading ? "Carregando…" : "Atualizar"}
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-center gap-2 py-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </CardContent>
        </Card>
      )}

      {stats.length === 0 && !loading && !error && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Database className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm">
              Clique em <strong>Atualizar</strong> para carregar as estatísticas
              de uso do banco.
            </p>
          </CardContent>
        </Card>
      )}

      {stats.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Tabelas listadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{stats.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Rows lidas (proxy egress)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {formatNumber(totalRowsRead)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Desde o último restart do Postgres
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Tamanho total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {(totalSize / 1024 / 1024).toFixed(1)} MB
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Top tabelas por leitura
              </CardTitle>
              {lastFetch && (
                <p className="text-xs text-muted-foreground">
                  Atualizado em {lastFetch.toLocaleTimeString("pt-BR")}
                </p>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tabela</TableHead>
                    <TableHead className="text-right">Rows lidas</TableHead>
                    <TableHead className="text-right">Insert</TableHead>
                    <TableHead className="text-right">Update</TableHead>
                    <TableHead className="text-right">Delete</TableHead>
                    <TableHead className="text-right">Rows vivas</TableHead>
                    <TableHead className="text-right">Tamanho</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.map((t) => (
                    <TableRow key={t.table_name}>
                      <TableCell className="font-mono text-xs">
                        {t.table_name}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(Number(t.rows_read))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatNumber(Number(t.rows_inserted))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatNumber(Number(t.rows_updated))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatNumber(Number(t.rows_deleted))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(Number(t.live_rows))}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {t.total_size_pretty}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border-muted">
            <CardContent className="py-4 text-xs text-muted-foreground space-y-1">
              <p>
                <strong>Como ler:</strong> "Rows lidas" é a soma de
                <code className="mx-1">seq_tup_read + idx_tup_fetch</code> do
                <code className="mx-1">pg_stat_user_tables</code>. Quanto maior,
                mais dados a tabela manda para clientes — proxy direto de
                egress.
              </p>
              <p>
                <strong>Observação:</strong> os contadores resetam quando o
                Postgres reinicia. Para comparativos diários, anote os valores
                ao final de cada dia.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
