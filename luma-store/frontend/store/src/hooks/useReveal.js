import { useCallback, useRef } from "react";

/**
 * useReveal — scroll-reveal con IntersectionObserver.
 *
 * Usa un callback ref en vez de useRef + useEffect para que funcione
 * con elementos que se montan condicionalmente (ej: después de fetch).
 *
 * CSS requerido:
 *   .reveal       { opacity:0; transform:translateY(28px); transition:... }
 *   .reveal.in-view { opacity:1; transform:none; }
 */
export function useReveal(threshold = 0.08) {
  const observerRef = useRef(null);

  const callbackRef = useCallback(
    (el) => {
      // Limpiar observer anterior si el elemento desmonta
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (!el) return;

      // Si ya tiene la clase in-view no hacer nada (hot-reload, etc.)
      if (el.classList.contains("in-view")) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            el.classList.add("in-view");
            observer.unobserve(el);
          }
        },
        { threshold }
      );

      observer.observe(el);
      observerRef.current = observer;
    },
    [threshold]
  );

  return callbackRef;
}
