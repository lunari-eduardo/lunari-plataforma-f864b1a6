/**
 * HubAutomacoes — Onda 4 (D2): painel do scheduler do Automation Engine.
 *
 * Mostra o estado do agendador (última/próxima execução), as regras de
 * gatilho por tempo do fotógrafo e o placar dos últimos 7 dias por regra.
 * Somente o dono vê seus dados (RLS + RPC `automation_schedule_overview`).
 */
import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { RefreshCw, Timer, Zap, AlertTriangle } from "lucide-react";

const TRIGGERS = [
  {
    kind: "lead.stalled",
    label: "Lead parado",
    hint: "Cria tarefa de follow-up quando um lead fica sem interação.",
    defaultDays: 7,
  },
  {
    kind: "session.no_gallery",
    label: "Sessão sem galeria",
    hint: "Cria tarefa quando uma sessão realizada segue sem galeria.",
    defaultDays: 7,
  },
  {
    kind: "charge.pending_stale",
    label: "Cobrança em aberto",
    hint: "Cria tarefa de lembrete quando uma cobrança fica pendente.",
    defaultDays: 5,
  },
] as const;

interface RuleRow {
  id: string;
  capability_id: string;
  trigger_kind: string | null;
  enabled: boolean;
  config: { days?: number } | null;
  last_run_at: string | null;
  ok: number;
  failed: number;
  approval_required: number;
  skipped: number;
}

interface Overview {
  globalEnabled: boolean;
  state: { last_run_at?: string; next_run_at?: string; last_cycle?: Record<string, unknown> };
  rules: RuleRow[];
}

function fmt(ts?: string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function HubAutomacoes() {
  const { user } = useAuth();
  const [data, setData] = React.useState<Overview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data: res, error } = await supabase.rpc("automation_schedule_overview");
    if (error) {
      toast({ title: "Não foi possível carregar as automações", variant: "destructive" });
    } else {
      setData(res as unknown as Overview);
    }
    setLoading(false);
  }, [user?.id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const ruleByTrigger = React.useMemo(() => {
    const map = new Map<string, RuleRow>();
    for (const r of data?.rules ?? []) if (r.trigger_kind) map.set(r.trigger_kind, r);
    return map;
  }, [data]);

  async function toggle(kind: string, defaultDays: number, enabled: boolean) {
    if (!user?.id) return;
    setBusy(kind);
    const existing = ruleByTrigger.get(kind);
    const payload = {
      ...(existing ? { id: existing.id } : {}),
      user_id: user.id,
      capability_id: "tasks.create",
      source_kind: kind,
      severity_max: "info",
      enabled,
      config: existing?.config ?? { days: defaultDays },
    };
    const { error } = await supabase
      .from("automation_rules")
      .upsert(payload, { onConflict: "user_id,capability_id,source_kind" });
    if (error) toast({ title: "Falha ao salvar a regra", variant: "destructive" });
    setBusy(null);
    await load();
  }

  async function setDays(kind: string, days: number) {
    const existing = ruleByTrigger.get(kind);
    if (!existing) return;
    setBusy(kind);
    const { error } = await supabase
      .from("automation_rules")
      .update({ config: { ...(existing.config ?? {}), days } })
      .eq("id", existing.id);
    if (error) toast({ title: "Falha ao salvar o prazo", variant: "destructive" });
    setBusy(null);
    await load();
  }

  async function runNow() {
    setBusy("__run");
    const { error } = await supabase.functions.invoke("automation-scheduler", {
      body: { source: "manual" },
    });
    if (error) toast({ title: "Falha ao executar o ciclo", variant: "destructive" });
    setBusy(null);
    await load();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <Timer size={14} className="text-primary" />
                Agendador
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                O Lunari verifica seus gatilhos a cada 5 minutos, mesmo com o app fechado.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading}>
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              </Button>
              <Button size="sm" variant="outline" onClick={() => void runNow()} disabled={busy === "__run"}>
                <Zap size={13} className="mr-1.5" />
                Executar agora
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <div className="text-muted-foreground">Automação global</div>
            <Badge variant={data?.globalEnabled ? "default" : "secondary"} className="mt-1 text-2xs">
              {data?.globalEnabled ? "ligada" : "desligada"}
            </Badge>
          </div>
          <div>
            <div className="text-muted-foreground">Última execução</div>
            <div className="text-foreground mt-1">{fmt(data?.state?.last_run_at)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Próxima execução</div>
            <div className="text-foreground mt-1">{fmt(data?.state?.next_run_at)}</div>
          </div>
        </CardContent>
      </Card>

      {data && !data.globalEnabled && (
        <div className="flex items-start gap-2 rounded-md border border-border/60 p-3 text-xs text-muted-foreground">
          <AlertTriangle size={14} className="text-primary mt-0.5 shrink-0" />
          <span>
            A automação está desligada globalmente. Suas regras ficam salvas, mas nada é
            executado até que a chave geral seja ativada.
          </span>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Gatilhos por tempo</CardTitle>
          <p className="text-xs text-muted-foreground">
            Cada gatilho cria uma tarefa para você. Nada é enviado ao cliente e nada é
            apagado — ações sensíveis continuam exigindo sua aprovação.
          </p>
        </CardHeader>
        <CardContent className="divide-y divide-border/60">
          {TRIGGERS.map((t) => {
            const rule = ruleByTrigger.get(t.kind);
            const days = rule?.config?.days ?? t.defaultDays;
            return (
              <div key={t.kind} className="py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm text-foreground">{t.label}</div>
                  <div className="text-xs text-muted-foreground">{t.hint}</div>
                  {rule && (
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-2xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        Após
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          defaultValue={days}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (v && v !== days) void setDays(t.kind, v);
                          }}
                          className="h-6 w-16 text-2xs"
                        />
                        dias
                      </span>
                      <span>último disparo: {fmt(rule.last_run_at)}</span>
                      <span>7 dias: {rule.ok} ok · {rule.failed} erro · {rule.approval_required} aguardando</span>
                    </div>
                  )}
                </div>
                <Switch
                  checked={!!rule?.enabled}
                  disabled={busy === t.kind}
                  onCheckedChange={(v) => void toggle(t.kind, t.defaultDays, v)}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
