import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Loader2, Mic, MicOff } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  buildAssistantSystemPrompt,
  listAllLunariAITools,
} from "@/shared/ai";
import type { AuthUser } from "@/shared/ports";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";

import { executeAssistantToolCall } from "../runtime/executeToolCall";
import { pageFromRoute } from "../runtime/pageFromRoute";
import { selectToolsForPage, MAX_TOOLS_PER_TURN } from "../runtime/selectToolsForPage";
import { useVoiceRecorder } from "../runtime/useVoiceRecorder";

const ASSISTANT_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assistant-chat`;

// ---------------------------------------------------------------------------
// Mapa de rótulos amigáveis por tool ID (namespace com __).
// Queries mostram "Consultando...", commands mostram nome da ação.
// ---------------------------------------------------------------------------
const TOOL_LABELS: Record<string, string> = {
  // Workflow — queries
  "workflow__listMonth": "Consultando sessões do mês",
  "workflow__listRange": "Consultando sessões por período",
  "workflow__metricsForMonth": "Calculando métricas do mês",
  "workflow__metricsForRange": "Calculando métricas do período",
  "workflow__pendingPayments": "Verificando pagamentos pendentes",
  "workflow__search": "Pesquisando sessões",
  "workflow__diagnoseSession": "Analisando sessão",
  "workflow__getCardBySession": "Buscando card",
  "workflow__getSessionFinancials": "Verificando financeiro",
  "workflow__listSessionsByPaymentStatus": "Filtrando por status financeiro",
  "workflow__statusOptions": "Carregando opções de status",
  "workflow__analytics__summary": "Calculando resumo analítico",
  "workflow__photoProductionForMonth": "Verificando produção fotográfica",
  "workflow__photoProductionForYear": "Verificando produção anual",
  "workflow__vendas__resumo": "Consultando resumo de vendas",
  "workflow__vendas__compararAnos": "Comparando anos",
  "workflow__vendas__metasProgresso": "Verificando metas",
  "workflow__produto__listBySession": "Listando produtos da sessão",
  "workflow__produto__listPending": "Verificando produção pendente",
  // Workflow — commands
  "workflow__addPayment": "Registrando pagamento",
  "workflow__advanceCard": "Avançando etapa",
  "workflow__updateFields": "Atualizando sessão",
  "workflow__deleteSession": "Excluindo sessão",
  "workflow__refundPayment": "Processando estorno",
  "workflow__syncFromAgenda": "Sincronizando com agenda",
  // Agenda
  "agenda__listAppointmentsByRange": "Consultando agenda",
  "agenda__checkSlot": "Verificando horário",
  "agenda__findNextAvailableSlot": "Buscando próximo horário disponível",
  "agenda__listAvailability": "Verificando disponibilidade",
  "agenda__getAppointmentById": "Buscando agendamento",
  // Clientes
  "clientes__list": "Buscando clientes",
  "clientes__get": "Carregando cliente",
  "clientes__search": "Pesquisando clientes",
  "clientes__listSessoes": "Buscando sessões do cliente",
  "clientes__listTransacoes": "Buscando transações do cliente",
  // Finance
  "finance__dashboardKpis": "Calculando KPIs",
  "finance__extratoSummary": "Consultando extrato",
  "finance__kpisByNature": "Analisando receitas e despesas",
  "finance__goalsProgress": "Verificando metas financeiras",
  // Leads
  "leads__list": "Buscando leads",
  "leads__search": "Pesquisando leads",
};

function getToolLabel(toolName: string, state: string): string {
  if (state === "output-available") return "";
  if (state === "output-error") return "Erro ao executar";
  return TOOL_LABELS[toolName] ?? "Consultando...";
}

// ---------------------------------------------------------------------------

function toAuthUser(user: ReturnType<typeof useAuth>["user"]): AuthUser | null {
  if (!user?.id) return null;
  return { id: user.id, email: user.email ?? undefined } as AuthUser;
}

export function AssistantChat() {
  const { user, session } = useAuth();
  const location = useLocation();
  const authUser = useMemo(() => toAuthUser(user), [user]);
  const authUserRef = useRef(authUser);
  authUserRef.current = authUser;

  const page = useMemo(() => pageFromRoute(location.pathname), [location.pathname]);

  // Snapshot + tool declarations rebuilt on every send (context is dynamic).
  const buildRequestBody = useCallback(() => {
    const u = authUserRef.current;
    const all = listAllLunariAITools({ user: u });
    // Providers de LLM têm limite prático (~128) de function declarations e
    // degradam muito antes disso. Priorizamos por relevância de página.
    const selected = selectToolsForPage(all, page, MAX_TOOLS_PER_TURN);
    const tools = selected.map((t) => ({
      name: t.id.replace(/\./g, "__"),
      description: t.description,
      parameters: t.inputSchema ?? { type: "object", properties: {} },
      needsApproval: t.needsApproval,
      kind: t.kind,
    }));
    const { system } = buildAssistantSystemPrompt({
      page,
      user: u,
      hints: {
        path: location.pathname,
        contextInfo: "O id da entidade atual geralmente está no final da URL."
      }
    });
    return { tools, system, page };
  }, [page]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: ASSISTANT_ENDPOINT,
        headers: () => ({
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        }),
        body: () => buildRequestBody(),
      }),
    [session?.access_token, buildRequestBody],
  );

  const { messages, sendMessage, status, stop, addToolResult, error } = useChat({
    id: `lunari-${authUser?.id ?? "anon"}`,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    // NOTA: onToolCall foi REMOVIDO intencionalmente.
    //
    // No AI SDK 5, onToolCall é chamado DENTRO do stream transform (enquanto
    // status === "streaming"). Nesse momento, addToolResult verifica
    // `this.status !== "streaming"` antes de disparar makeRequest — e falha
    // silenciosamente. O segundo turno para o Gemini nunca acontece.
    //
    // A solução correta é detectar tools pendentes DEPOIS do stream fechar
    // (status === "ready"), via useEffect abaixo.
  });

  // ---------------------------------------------------------------------------
  // Execução de tools APÓS o stream fechar (pós-stream, não dentro do stream).
  // ---------------------------------------------------------------------------
  // Ref para evitar execuções duplicadas por re-render e state para UI.
  const executingToolsRef = useRef<Set<string>>(new Set());
  const [executingToolCount, setExecutingToolCount] = useState(0);

  useEffect(() => {
    // Só roda quando o stream terminou (status = "ready").
    if (status !== "ready") return;

    const u = authUserRef.current;
    if (!u) return;

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "assistant") return;

    // Filtra tools pendentes (estado "input-available" = aguardando execução).
    const pendingParts = lastMessage.parts.filter(
      (p): p is typeof p & { type: string; state: string; toolCallId: string; input: unknown; toolName?: string } =>
        p.type?.startsWith("tool-") &&
        (p as any).state === "input-available" &&
        !(p as any).providerExecuted
    );

    if (pendingParts.length === 0) return;

    // Executa cada tool pendente que ainda não está sendo executada.
    for (const part of pendingParts) {
      const toolCallId = (part as any).toolCallId as string;
      if (executingToolsRef.current.has(toolCallId)) continue;
      executingToolsRef.current.add(toolCallId);
      setExecutingToolCount(executingToolsRef.current.size);

      // Nome da tool no AI SDK 5 vem em part.toolName
      const toolName = (part as any).toolName;

      // Argumentos no AI SDK 5 vêm em part.args (input era usado em versões antigas/internas)
      const input = (part as any).args ?? (part as any).input;

      // Executa assincronamente sem bloquear o effect.
      void (async () => {
        try {
          // Convert namespaced name back (workflow__addPayment → workflow.addPayment).
          const capabilityId = toolName.replace(/__/g, ".");
          const result = await executeAssistantToolCall({
            toolName: capabilityId,
            input,
            user: u,
          });
          console.info(
            `[Lu] tool ${capabilityId} → ${result.status}${
              result.latencyMs ? ` (${result.latencyMs}ms)` : ""
            }`,
            result.error ?? "",
          );
          await addToolResult({
            tool: toolName,
            toolCallId,
            output: result,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[Lu] tool ${toolName} exception:`, message);
          await addToolResult({
            tool: toolName,
            toolCallId,
            output: { status: "error", error: message },
          });
        } finally {
          executingToolsRef.current.delete(toolCallId);
          setExecutingToolCount(executingToolsRef.current.size);
        }
      })();
    }
  }, [status, messages, addToolResult]);

  const disabled = !authUser || !session?.access_token || executingToolCount > 0;
  const isLoading = status === "submitted" || status === "streaming" || executingToolCount > 0;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <Conversation className="flex-1">
        <ConversationContent className="space-y-3 px-4 py-4">
          {messages.length === 0 && (
            <div className="mx-auto max-w-sm py-10 text-center text-sm text-muted-foreground">
              Olá! Estou pronta para ajudar na gestão do seu estúdio.{" "}
              Como posso ser útil hoje?
            </div>
          )}

          {messages.map((message) => (
            <Message key={message.id} from={message.role === "user" ? "user" : "assistant"}>
              <MessageContent>
                {message.parts.map((part, i) => {
                  if (part.type === "text") {
                    return message.role === "assistant" ? (
                      <MessageResponse key={i}>{part.text}</MessageResponse>
                    ) : (
                      <span key={i} className="whitespace-pre-wrap">{part.text}</span>
                    );
                  }

                  // Renderização discreta de tool calls (sem nomes técnicos ou JSON).
                  if (part.type?.startsWith("tool-")) {
                    const p = part as unknown as {
                      type: string;
                      state: string;
                      toolCallId?: string;
                      input?: unknown;
                      output?: unknown;
                      errorText?: string;
                    };
                    const toolName = p.type.startsWith("tool-")
                      ? p.type.slice("tool-".length)
                      : p.type;
                    const label = getToolLabel(toolName, p.state);

                    // Tool concluída com sucesso: não exibir nada (o Gemini
                    // já vai resumir o resultado na resposta textual).
                    if (p.state === "output-available") return null;

                    // Tool com erro: exibir mensagem amigável.
                    if (p.state === "output-error") {
                      return (
                        <div
                          key={i}
                          className="mt-1 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs text-destructive"
                        >
                          Não foi possível completar a consulta.
                          {p.errorText && (
                            <span className="ml-1 opacity-70">({p.errorText})</span>
                          )}
                        </div>
                      );
                    }

                    // Tool em andamento (input-available, input-streaming):
                    // exibir indicador discreto com rótulo amigável.
                    if (label) {
                      return (
                        <div
                          key={i}
                          className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"
                        >
                          <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                          <span>{label}…</span>
                        </div>
                      );
                    }

                    return null;
                  }

                  return null;
                })}
                {message.experimental_attachments?.map((att, i) => (
                  <div key={`att-${i}`} className="mt-2">
                    {att.contentType?.startsWith("audio/") ? (
                      <audio controls src={att.url} className="h-8 max-w-full" />
                    ) : (
                      <a href={att.url} target="_blank" rel="noreferrer" className="text-sm underline">
                        {att.name || "Anexo"}
                      </a>
                    )}
                  </div>
                ))}
              </MessageContent>
            </Message>
          ))}

          {status === "submitted" && (
            <div className="px-1 py-2">
              <Shimmer>Pensando…</Shimmer>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error.message || "Erro ao contactar a Lunari."}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border/60 p-3">
        <VoicePromptInput
          disabled={disabled}
          status={status}
          onStop={stop}
          onSend={(text) => void sendMessage({ text })}
        />
      </div>

      {isLoading && (
        <div className="sr-only" aria-live="polite">Lunari está respondendo…</div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Composer com voz (Onda E.4).
// Mantém `PromptInput` como fonte de layout e injeta um botão de microfone
// que grava WAV via Web Audio, envia ao `assistant-transcribe` e insere o
// texto transcrito no textarea (o usuário confirma antes de enviar).
// ────────────────────────────────────────────────────────────────────────────

interface VoicePromptInputProps {
  disabled: boolean;
  status: ReturnType<typeof useChat>["status"];
  onStop: () => void;
  onSend: (text: string) => void;
}

function VoicePromptInput({
  disabled,
  status,
  onStop,
  onSend,
}: VoicePromptInputProps) {
  const recorder = useVoiceRecorder();
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const handleMicClick = useCallback(async () => {
    setVoiceError(null);
    if (recorder.isRecording) {
      const blob = await recorder.stop();
      if (!blob) {
        setVoiceError(recorder.error || "Gravação inválida.");
        return;
      }
      setTranscribing(true);
      try {
        // NUNCA enviar o áudio como texto (base64 estourava ~80k tokens/turno).
        // O WAV vai para `assistant-transcribe` e só o TEXTO volta ao composer.
        const form = new FormData();
        form.append("file", blob, "recording.wav");
        form.append("stream", ""); // resposta JSON bufferizada
        const { data, error } = await supabase.functions.invoke("assistant-transcribe", {
          body: form,
        });
        if (error) throw error;
        const text = String(
          (data as { text?: string })?.text ?? "",
        ).trim();
        if (!text) {
          setVoiceError("Não consegui entender o áudio. Tente de novo.");
          return;
        }
        const el = wrapRef.current?.querySelector("textarea");
        if (el) {
          const setter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            "value",
          )?.set;
          const next = el.value ? `${el.value} ${text}` : text;
          setter?.call(el, next);
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.focus();
        } else {
          onSend(text);
        }
      } catch (err) {
        setVoiceError(err instanceof Error ? err.message : String(err));
      } finally {
        setTranscribing(false);
      }
    } else {
      await recorder.start();
    }
  }, [recorder, onSend]);

  const micDisabled = disabled || transcribing;

  return (
    <div ref={wrapRef}>
    <PromptInput
      onSubmit={(msg) => {
        const text = msg.text?.trim();
        if (!text || disabled) return;
        // Guard-rail: nunca enviar áudio/arquivo embutido como texto.
        if (text.startsWith("data:")) return;
        onSend(text);
      }}
    >
      <PromptInputTextarea
        placeholder={
          disabled
            ? "Faça login para conversar com a Lunari…"
            : recorder.isRecording
              ? "Gravando… clique no microfone para transcrever."
              : transcribing
                ? "Transcrevendo…"
                : "Peça algo à Lunari — ou clique no microfone."
        }
        disabled={disabled || transcribing}
        autoFocus
      />
      <PromptInputFooter className="justify-between">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={recorder.isRecording ? "destructive" : "ghost"}
            onClick={handleMicClick}
            disabled={micDisabled}
            aria-label={recorder.isRecording ? "Parar gravação" : "Gravar por voz"}
            className={cn("gap-1", recorder.isRecording && "animate-pulse")}
          >
            {transcribing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : recorder.isRecording ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {transcribing
                ? "Transcrevendo"
                : recorder.isRecording
                  ? "Parar"
                  : "Voz"}
            </span>
          </Button>
          {voiceError && (
            <span className="text-xs text-destructive">{voiceError}</span>
          )}
        </div>
        <PromptInputSubmit status={status} disabled={disabled} onStop={onStop} />
      </PromptInputFooter>
    </PromptInput>
    </div>
  );
}
