import type { TechnicalSnapshot } from "../types";
import type { SupportHost } from "../SupportHostProvider";

function detectOS(ua: string): string {
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS X/i.test(ua)) return "macOS";
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Desconhecido";
}

function detectBrowser(ua: string): string {
  if (/Edg\//.test(ua)) return "Edge";
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
  return "Desconhecido";
}

export function captureTechnicalSnapshot(host: SupportHost): TechnicalSnapshot {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const viewport =
    typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "";
  const locale = typeof navigator !== "undefined" ? navigator.language : "";
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return {
    plan: host.plan?.label ?? null,
    app_version: host.appVersion ?? null,
    origin_path: typeof location !== "undefined" ? location.pathname : null,
    user_agent: ua,
    os: detectOS(ua),
    browser: detectBrowser(ua),
    locale,
    viewport,
    timezone: tz,
  };
}
