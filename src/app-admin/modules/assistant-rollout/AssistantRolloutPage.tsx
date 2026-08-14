import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Sparkles, UserPlus, Trash2 } from "lucide-react";

/**
 * Rollout da assistente Lu (Admin → Beta autorizados → Todos).
 *
 * Estágio ativo lido/gravado em `app_settings.assistant_rollout_stage`.
 * Lista de beta em `assistant_beta_access`.
 */

type Stage = "admin" | "beta" | "geral";

type RequestRow = {
  id: string;
  user_id: string;
  message: string | null;
  created_at: string;
  email?: string | null;
};

type BetaRow = {
  user_id: string;
  granted_at: string;
  note: string | null;
  email?: string | null;
};

const STAGE_LABEL: Record<Stage, string> = {
  admin: "Admin — só administradores da Lunari",
  beta: "Beta autorizado — admins + lista curada",
  geral: "Geral — todos os usuários autenticados",
};

export default function AssistantRolloutPage() {
  const [stage, setStage] = useState<Stage>("admin");
  const [saving, setSaving] = useState(false);
  const [beta, setBeta] = useState<BetaRow[]>([]);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [metrics, setMetrics] = useState<{ total: number; blocked: number } | null>(null);
  const [apiProvider, setApiProvider] = useState<string>("gemini");
  const [apiModel, setApiModel] = useState<string>("gemini-3.5-flash-lite");
  const [apiKey, setApiKey] = useState("");
  const [requests, setRequests] = useState<RequestRow[]>([]);
  // Estado do cofre: null = carregando, false = sem chave, number = tamanho da chave salva
  const [savedKeyLength, setSavedKeyLength] = useState<number | null | false>(null);

  const loadAll = async () => {
    const [{ data: settingRows }, { data: provRows }, { data: modRows }, { data: betaRows }, { data: invRows }] = await Promise.all([
      supabase.from("app_settings").select("value").eq("key", "assistant_rollout_stage").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "assistant_ai_provider").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "assistant_ai_model").maybeSingle(),
      supabase.from("assistant_beta_access").select("user_id, granted_at, note").order("granted_at", { ascending: false }),
      supabase.from("assistant_invocations").select("output_status").gte("created_at", new Date(Date.now() - 30 * 864e5).toISOString()),
    ]);

    const raw = (settingRows as any)?.value;
    const s = typeof raw === "string" ? raw : (raw as string);
    if (s === "admin" || s === "beta" || s === "geral") setStage(s);

    const provRaw = (provRows as any)?.value;
    const currentProvider = typeof provRaw === "string" ? provRaw : "gemini";
    if (provRaw) setApiProvider(currentProvider);

    const modRaw = (modRows as any)?.value;
    if (modRaw) setApiModel(typeof modRaw === "string" ? modRaw : "gemini-3.5-flash-lite");

    // Verificar status da chave no cofre via Edge Function de diagnóstico
    // (não podemos ler a tabela diretamente — RLS protege)
    // Usamos uma chamada RPC simples que retorna apenas o comprimento da chave
    const { data: keyCheck } = await supabase.rpc("check_assistant_key_status", {
      p_provider_name: currentProvider,
    }).maybeSingle();
    setSavedKeyLength((keyCheck as any)?.key_length ?? false);

    const rows = (betaRows ?? []) as BetaRow[];
    if (rows.length) {
      const ids = rows.map((r) => r.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", ids);
      const map = new Map<string, string | null>((profs ?? []).map((p: any) => [p.id, p.email]));
      rows.forEach((r) => (r.email = map.get(r.user_id) ?? null));
    }
    setBeta(rows);

    const { data: reqRows } = await supabase
      .from("assistant_access_requests")
      .select("id, user_id, message, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    const reqs = (reqRows ?? []) as RequestRow[];
    if (reqs.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", reqs.map((r) => r.user_id));
      const pmap = new Map<string, string | null>((profs ?? []).map((p: any) => [p.id, p.email]));
      reqs.forEach((r) => (r.email = pmap.get(r.user_id) ?? null));
    }
    setRequests(reqs);

    const invocations = (invRows ?? []) as unknown as { output_status: string | null }[];
    setMetrics({
      total: invocations.length,
      blocked: invocations.filter((r) => r.output_status === "blocked_by_rollout").length,
    });
  };

  useEffect(() => {
    loadAll();
  }, []);

  const changeStage = async (next: Stage) => {
    setSaving(true);
    const { error } = await supabase.rpc("assistant_rollout_set", { _stage: next });
    setSaving(false);
    if (error) {
      toast.error("Falha ao alterar estágio: " + error.message);
      return;
    }
    setStage(next);
  };

  const addBeta = async () => {
    if (!email.trim()) return;
    setBusy(true);
    const { data: prof, error: findErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();
    if (findErr || !prof) {
      setBusy(false);
      toast.error("Usuário não encontrado com esse email");
      return;
    }
    const { error } = await supabase
      .from("assistant_beta_access")
      .upsert({ user_id: (prof as any).id, note: note.trim() || null });
    setBusy(false);
    if (error) {
      toast.error("Falha ao adicionar: " + error.message);
      return;
    }
    setEmail("");
    setNote("");
    await loadAll();
  };

  const decideRequest = async (id: string, approve: boolean) => {
    setBusy(true);
    const { error } = await supabase.rpc("assistant_access_request_decide", {
      _id: id,
      _approve: approve,
    });
    setBusy(false);
    if (error) return toast.error("Falha ao decidir: " + error.message);
    await loadAll();
  };

  const removeBeta = async (userId: string) => {
    const { error } = await supabase.from("assistant_beta_access").delete().eq("user_id", userId);
    if (error) return toast.error("Falha ao remover: " + error.message);
    await loadAll();
  };

  const saveApiConfig = async () => {
    if (!apiKey.trim()) {
      toast.error("Digite a nova chave de API antes de salvar.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("set_assistant_provider_key", {
      p_provider_name: apiProvider,
      p_api_key: apiKey.trim(),
      p_model_id: apiModel,
    });
    setSaving(false);
    if (error) {
      toast.error("Falha ao salvar configurações de API: " + error.message);
      return;
    }
    toast.success("Configurações de IA salvas com sucesso!");
    setApiKey(""); // Limpa o campo de senha por segurança
    // Recarrega o status da chave para refletir no badge
    const { data: keyCheck } = await supabase.rpc("check_assistant_key_status", {
      p_provider_name: apiProvider,
    }).maybeSingle();
    setSavedKeyLength((keyCheck as any)?.key_length ?? false);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Rollout da Assistente Lu</h1>
          <p className="text-sm text-muted-foreground">
            Controle quem pode acessar a Lu enquanto ela está em beta.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estágio ativo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={stage} onValueChange={(v) => changeStage(v as Stage)} disabled={saving}>
            <SelectTrigger className="max-w-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">{STAGE_LABEL.admin}</SelectItem>
              <SelectItem value="beta">{STAGE_LABEL.beta}</SelectItem>
              <SelectItem value="geral">{STAGE_LABEL.geral}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            A mudança é global e vale imediatamente. Fail-closed: em qualquer erro a Lu é escondida.
          </p>
        </CardContent>
      </Card>

      {metrics && (
        <Card>
          <CardHeader>
            <CardTitle>Últimos 30 dias</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-3xl font-semibold">{metrics.total}</div>
              <div className="text-xs text-muted-foreground">Invocações totais</div>
            </div>
            <div>
              <div className="text-3xl font-semibold">{metrics.blocked}</div>
              <div className="text-xs text-muted-foreground">Bloqueadas pelo rollout</div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Pedidos de acesso ({requests.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pedido pendente.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>Pedido em</TableHead>
                  <TableHead className="w-44"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.email ?? r.user_id}</TableCell>
                    <TableCell className="text-muted-foreground">{r.message ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="flex gap-2">
                      <Button size="sm" disabled={busy} onClick={() => decideRequest(r.id, true)}>
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => decideRequest(r.id, false)}
                      >
                        Negar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Beta autorizado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              className="max-w-xs"
              placeholder="email@dominio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
            />
            <Input
              className="max-w-xs"
              placeholder="Nota (opcional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button onClick={addBeta} disabled={busy || !email}>
              <UserPlus className="mr-2 h-4 w-4" />
              Adicionar
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead>Concedido em</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {beta.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    Nenhum usuário na lista de beta.
                  </TableCell>
                </TableRow>
              )}
              {beta.map((row) => (
                <TableRow key={row.user_id}>
                  <TableCell>{row.email ?? row.user_id}</TableCell>
                  <TableCell className="text-muted-foreground">{row.note ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(row.granted_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon-sm" onClick={() => removeBeta(row.user_id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cofre de APIs (Motor de IA)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Configure o provedor de Inteligência Artificial ativo. A chave de API nunca é exibida na tela por segurança.
          </p>

          {/* Badge de status da chave no cofre */}
          <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <span className="font-medium text-muted-foreground">Status do cofre:</span>
            {savedKeyLength === null && (
              <span className="text-muted-foreground">Verificando...</span>
            )}
            {savedKeyLength === false && (
              <span className="font-medium text-destructive">❌ Não configurado — nenhuma chave encontrada para este provedor.</span>
            )}
            {typeof savedKeyLength === "number" && savedKeyLength < 30 && (
              <span className="font-medium text-amber-500">⚠️ Chave suspeita ({savedKeyLength} chars) — parece curta ou inválida. Reconfigure.</span>
            )}
            {typeof savedKeyLength === "number" && savedKeyLength >= 30 && (
              <span className="font-medium text-emerald-600">✅ Chave configurada ({savedKeyLength} chars).</span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Provedor</label>
              <Select value={apiProvider} onValueChange={setApiProvider} disabled={saving}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                  <SelectItem value="deepseek">DeepSeek</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="lovable">Lovable Gateway</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Modelo Ativo</label>
              {apiProvider === "lovable" || !apiProvider ? (
                <Input 
                  value={apiModel} 
                  onChange={(e) => setApiModel(e.target.value)} 
                  placeholder="Ex: deepseek-chat" 
                  disabled={saving}
                />
              ) : (
                <Select value={apiModel} onValueChange={setApiModel} disabled={saving}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um modelo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {apiProvider === "gemini" && (
                      <>
                        <SelectItem value="gemini-3.5-flash-lite">Gemini 3.5 Flash-Lite (Rápido/Barato)</SelectItem>
                        <SelectItem value="gemini-3.7-flash">Gemini 3.7 Flash (Recomendado)</SelectItem>
                        <SelectItem value="gemini-3.1-pro">Gemini 3.1 Pro (Raciocínio Avançado)</SelectItem>
                      </>
                    )}
                    {apiProvider === "deepseek" && (
                      <>
                        <SelectItem value="deepseek-chat">DeepSeek V3 (Chat)</SelectItem>
                        <SelectItem value="deepseek-reasoner">DeepSeek R1 (Reasoner)</SelectItem>
                      </>
                    )}
                    {apiProvider === "openai" && (
                      <>
                        <SelectItem value="gpt-4o-mini">GPT-4o Mini (Rápido/Barato)</SelectItem>
                        <SelectItem value="gpt-4o">GPT-4o (Recomendado/Multimodal)</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nova Chave de API</label>
              <Input 
                type="password"
                value={apiKey} 
                onChange={(e) => setApiKey(e.target.value)} 
                placeholder={apiProvider === "gemini" ? "Cole aqui (deve começar com AIza...)" : "Cole a nova chave aqui"}
                disabled={saving}
                autoComplete="new-password"
              />
              {apiProvider === "gemini" && apiKey && !apiKey.startsWith("AIza") && (
                <p className="text-xs text-amber-500">⚠️ Chaves do Google AI Studio começam com &quot;AIza&quot;. Verifique se a chave é correta.</p>
              )}
              <p className="text-xs text-muted-foreground">Obtenha sua chave em <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline">Google AI Studio</a>. Sempre cole a chave completa.</p>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={saveApiConfig} disabled={saving}>
              Salvar Configuração do Cofre
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
