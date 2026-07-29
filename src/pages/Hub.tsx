/**
 * Hub de IA — Onda 5 (ADR-019).
 *
 * Endereço único para o fotógrafo "conversar com o cérebro do Lunari":
 * Contexto declarado, Aprovações pendentes, Conexões (OAuth/PAT) e
 * Atividade (audit de invocações).
 *
 * Abas surgem progressivamente conforme as engines nascem. Ondas futuras
 * plugam: Conhecimento (6), Hoje (10), Memória (12), Automações (13).
 */
import * as React from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Sparkles, ShieldCheck, Plug, Activity, Brain } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useContextSnapshot } from "@/shared/context/react";
import AssistenteAprovacoes from "@/pages/AssistenteAprovacoes";
import AssistenteMcpTokens from "@/pages/AssistenteMcpTokens";
import HubAtividade from "@/components/hub/HubAtividade";

type TabKey = "contexto" | "aprovacoes" | "conexoes" | "atividade";
const VALID: TabKey[] = ["contexto", "aprovacoes", "conexoes", "atividade"];

export default function Hub() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const initial = (params.get("tab") as TabKey) || "contexto";
  const [tab, setTab] = React.useState<TabKey>(
    VALID.includes(initial) ? initial : "contexto",
  );

  const onChange = (v: string) => {
    const t = (v as TabKey) ?? "contexto";
    setTab(t);
    const next = new URLSearchParams(params);
    next.set("tab", t);
    setParams(next, { replace: true });
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[79rem] mx-auto">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Brain size={18} className="text-primary" />
            <h1 className="text-xl font-semibold text-foreground">Hub de IA</h1>
            <Badge variant="secondary" className="text-2xs">beta</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Onde você conversa com o cérebro do Lunari. Contexto declarado,
            aprovações, conexões e histórico do assistente.
          </p>
        </div>
      </header>

      <Tabs value={tab} onValueChange={onChange} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="contexto" className="gap-1.5">
            <Sparkles size={13} /> <span className="hidden sm:inline">Contexto</span>
          </TabsTrigger>
          <TabsTrigger value="aprovacoes" className="gap-1.5">
            <ShieldCheck size={13} /> <span className="hidden sm:inline">Aprovações</span>
          </TabsTrigger>
          <TabsTrigger value="conexoes" className="gap-1.5">
            <Plug size={13} /> <span className="hidden sm:inline">Conexões</span>
          </TabsTrigger>
          <TabsTrigger value="atividade" className="gap-1.5">
            <Activity size={13} /> <span className="hidden sm:inline">Atividade</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contexto" className="mt-4">
          <HubContexto />
        </TabsContent>
        <TabsContent value="aprovacoes" className="mt-4">
          <AssistenteAprovacoes />
        </TabsContent>
        <TabsContent value="conexoes" className="mt-4">
          <AssistenteMcpTokens />
        </TabsContent>
        <TabsContent value="atividade" className="mt-4">
          <HubAtividade />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HubContexto() {
  const { user } = useAuth();
  const { data, isLoading } = useContextSnapshot(user?.id);
  const facts = data ? Object.values(data.facts) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles size={14} className="text-primary" />
          Contexto declarado
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Fatos de alta confiança que o Lunari sabe sobre você. Origem: humano.
          Para editar, use Meu Perfil / Configurações.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Carregando contexto…</p>
        ) : facts.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhum fato declarado ainda. Complete seu perfil em Configurações.
          </p>
        ) : (
          <ul className="divide-y divide-border/60 text-sm">
            {facts.map((f) => (
              <li key={f.key} className="py-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground font-mono">{f.key}</div>
                  <div className="text-sm text-foreground break-words">
                    {typeof f.value === "string" || typeof f.value === "number"
                      ? String(f.value)
                      : JSON.stringify(f.value)}
                  </div>
                </div>
                <Badge
                  variant={f.confidence === "high" ? "default" : "secondary"}
                  className="text-2xs shrink-0"
                >
                  {f.confidence}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
