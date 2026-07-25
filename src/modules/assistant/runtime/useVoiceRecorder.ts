/**
 * Onda E.4 — Gravador de voz para a Lu.
 *
 * Captura PCM via Web Audio API e devolve um WAV mono 16kHz completo
 * (formato garantido de ser decodável no Gateway STT, evitando os problemas
 * de fragmentos MediaRecorder e do MP4 fragmentado do Safari iOS).
 *
 * Uso:
 *   const rec = useVoiceRecorder();
 *   await rec.start();
 *   const blob = await rec.stop(); // Blob WAV pronto para upload
 */
import { useCallback, useEffect, useRef, useState } from "react";

const TARGET_SAMPLE_RATE = 16000;

type State = "idle" | "recording" | "stopping" | "error";

interface Session {
  stream: MediaStream;
  ctx: AudioContext;
  source: MediaStreamAudioSourceNode;
  processor: ScriptProcessorNode;
  chunks: Float32Array[];
  sourceRate: number;
}

function downsampleTo16k(buffer: Float32Array, sourceRate: number): Float32Array {
  if (sourceRate === TARGET_SAMPLE_RATE) return buffer;
  const ratio = sourceRate / TARGET_SAMPLE_RATE;
  const newLen = Math.floor(buffer.length / ratio);
  const out = new Float32Array(newLen);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < newLen) {
    const nextOffset = Math.floor((offsetResult + 1) * ratio);
    let sum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffset && i < buffer.length; i++) {
      sum += buffer[i];
      count++;
    }
    out[offsetResult] = count ? sum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffset;
  }
  return out;
}

function encodeWav(pcm: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const blockAlign = 1 * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let off = 44;
  for (let i = 0; i < pcm.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export interface UseVoiceRecorder {
  state: State;
  error: string | null;
  isRecording: boolean;
  start: () => Promise<void>;
  stop: () => Promise<Blob | null>;
  cancel: () => void;
}

export function useVoiceRecorder(): UseVoiceRecorder {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<Session | null>(null);

  const cleanup = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return;
    try { s.processor.disconnect(); } catch { /* noop */ }
    try { s.source.disconnect(); } catch { /* noop */ }
    try { s.stream.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
    try { void s.ctx.close(); } catch { /* noop */ }
    sessionRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    if (sessionRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      const chunks: Float32Array[] = [];
      processor.onaudioprocess = (e) => {
        chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };
      source.connect(processor);
      processor.connect(ctx.destination);
      sessionRef.current = { stream, ctx, source, processor, chunks, sourceRate: ctx.sampleRate };
      setState("recording");
    } catch (err) {
      setError(
        err instanceof Error && err.name === "NotAllowedError"
          ? "Permissão de microfone negada."
          : "Não consegui acessar o microfone.",
      );
      setState("error");
    }
  }, []);

  const stop = useCallback(async (): Promise<Blob | null> => {
    const s = sessionRef.current;
    if (!s) return null;
    setState("stopping");
    // Concatenate chunks
    let total = 0;
    for (const c of s.chunks) total += c.length;
    const merged = new Float32Array(total);
    let off = 0;
    for (const c of s.chunks) { merged.set(c, off); off += c.length; }
    const downsampled = downsampleTo16k(merged, s.sourceRate);
    cleanup();
    setState("idle");
    if (downsampled.length < TARGET_SAMPLE_RATE * 0.3) {
      // < 300ms de áudio útil — não vale a pena mandar
      setError("Gravação muito curta.");
      return null;
    }
    return encodeWav(downsampled, TARGET_SAMPLE_RATE);
  }, [cleanup]);

  const cancel = useCallback(() => {
    cleanup();
    setState("idle");
    setError(null);
  }, [cleanup]);

  return {
    state,
    error,
    isRecording: state === "recording",
    start,
    stop,
    cancel,
  };
}
