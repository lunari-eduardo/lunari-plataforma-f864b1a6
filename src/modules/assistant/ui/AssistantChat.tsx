import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { useCallback, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Loader2, Mic, MicOff } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
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
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";

import { executeAssistantToolCall } from "../runtime/executeToolCall";
import { pageFromRoute } from "../runtime/pageFromRoute";
import { selectToolsForPage, MAX_TOOLS_PER_TURN } from "../runtime/selectToolsForPage";
import { useVoiceRecorder } from "../runtime/useVoiceRecorder";

const ASSISTANT_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assistant-chat`;

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
    onToolCall: async ({ toolCall }) => {
      const u = authUserRef.current;
      if (!u) {
        await addToolResult({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          output: { status: "error", error: "Usuário não autenticado" },
        });
        return;
      }
      // Convert namespaced name back (workflow__addPayment → workflow.addPayment).
      const capabilityId = toolCall.toolName.replace(/__/g, ".");
      const result = await executeAssistantToolCall({
        toolName: capabilityId,
        input: toolCall.input,
        user: u,
      });
      await addToolResult({
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
        output: result,
      });
    },
  });

  const disabled = !authUser || !session?.access_token;
  const isLoading = status === "submitted" || status === "streaming";

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <Conversation className="flex-1">
        <ConversationContent className="space-y-3 px-4 py-4">
          {messages.length === 0 && (
            <div className="mx-auto max-w-sm py-10 text-center text-sm text-muted-foreground">
              Oi, sou a <span className="font-medium text-foreground">Lunari</span>.
              Posso consultar e operar sua página <span className="font-medium">{page}</span>.
              Peça relatório, ação ou ajuda operacional — ações sensíveis pedem sua confirmação.
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
                  if (part.type?.startsWith("tool-")) {
                    const p = part as unknown as {
                      type: string;
                      state: string;
                      input?: unknown;
                      output?: unknown;
                      errorText?: string;
                    };
                    return (
                      <Tool key={i} defaultOpen={false}>
                        <ToolHeader
                          type={p.type as `tool-${string}`}
                          state={p.state as never}
                        />
                        <ToolContent>
                          {p.input !== undefined && <ToolInput input={p.input} />}
                          <ToolOutput output={p.output} errorText={p.errorText} />
                        </ToolContent>
                      </Tool>
                    );
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
        // Converter blob para base64 e enviar inline ao Gemini
        // (não usar Storage: bucket é privado e Gemini não lê URLs externas)
        const arrayBuffer = await blob.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
        const base64 = btoa(binary);
        const dataUrl = `data:audio/wav;base64,${base64}`;
        // Enviar como mensagem de texto com dataUrl embutida no conteúdo
        // A Edge Function detecta o prefixo data:audio e passa como inlineData para o Gemini
        onSend(dataUrl);
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
