import { useEffect, useRef, useState } from "react";

export function useReveal<T extends HTMLElement>(options?: IntersectionObserverInit) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.unobserve(el);
      }
    }, {
      threshold: 0.1,
      ...options
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [options]);

  return { ref, visible };
}
