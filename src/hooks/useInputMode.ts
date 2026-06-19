import { useEffect, useState } from "react";

export type InputMode = "mouse" | "touch";

function detect(): InputMode {
  if (typeof window === "undefined") return "mouse";
  const hoverFine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  return hoverFine ? "mouse" : "touch";
}

/**
 * Returns whether the primary input is a precise pointer (mouse/trackpad)
 * or a touch surface. Updates at runtime when the user switches input
 * (e.g. Surface docking a keyboard).
 */
export function useInputMode(): InputMode {
  const [mode, setMode] = useState<InputMode>(() => detect());

  useEffect(() => {
    const mqlHover = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setMode(detect());

    const onPointer = (e: PointerEvent) => {
      const next: InputMode = e.pointerType === "mouse" ? "mouse" : "touch";
      setMode((prev) => (prev === next ? prev : next));
    };

    mqlHover.addEventListener?.("change", sync);
    window.addEventListener("pointerdown", onPointer, { passive: true });
    return () => {
      mqlHover.removeEventListener?.("change", sync);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  return mode;
}
