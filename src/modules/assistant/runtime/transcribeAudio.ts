/**
 * Onda E.4 — cliente do assistant-transcribe.
 *
 * Envia o WAV para a edge function e reconstrói o texto a partir dos
 * eventos SSE (`transcript.text.delta` + `transcript.text.done`).
 */

const TRANSCRIBE_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assistant-transcribe`;

export interface TranscribeOptions {
  accessToken: string;
  audio: Blob;
  onPartial?: (text: string) => void;
  signal?: AbortSignal;
}

export async function transcribeAudio({
  accessToken,
  audio,
  onPartial,
  signal,
}: TranscribeOptions): Promise<string> {
  const form = new FormData();
  form.append("file", audio, "recording.wav");
  form.append("stream", "true");

  const resp = await fetch(TRANSCRIBE_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
    signal,
  });
  if (!resp.ok || !resp.body) {
    const t = await resp.text().catch(() => "");
    throw new Error(`Transcrição falhou (${resp.status}): ${t.slice(0, 300)}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  let finalText = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const ev of events) {
      for (const line of ev.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload);
          if (json.type === "transcript.text.delta" && typeof json.delta === "string") {
            full += json.delta;
            onPartial?.(full);
          } else if (json.type === "transcript.text.done" && typeof json.text === "string") {
            finalText = json.text;
          }
        } catch {
          /* ignore malformed */
        }
      }
    }
  }
  return (finalText || full).trim();
}
