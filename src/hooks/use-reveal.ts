import { useEffect, useRef, useState } from "react";

/**
 * Reveal por scroll com rede de segurança:
 * - `armed` só fica true depois do mount, e apenas se IntersectionObserver existir.
 * - Enquanto não estiver armado, o CSS mantém o conteúdo visível.
 * Assim uma falha do observer nunca deixa texto invisível na tela.
 */
export function useReveal<T extends HTMLElement>(options?: IntersectionObserverInit) {
  const [visible, setVisible] = useState(false);
  const [armed, setArmed] = useState(false);
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    setArmed(true);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.05, rootMargin: "0px 0px -8% 0px", ...options }
    );

    observer.observe(el);

    // Fallback: se em 1.2s nada disparou (layout tardio, tela alta), revela.
    const timeout = window.setTimeout(() => setVisible(true), 1200);

    return () => {
      window.clearTimeout(timeout);
      observer.disconnect();
    };
  }, [options]);

  return { ref, visible, armed };
}
