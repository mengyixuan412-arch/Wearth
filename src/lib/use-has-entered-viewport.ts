"use client";

import { useCallback, useEffect, useState } from "react";

export function useHasEnteredViewport(options?: {
  once?: boolean;
  threshold?: number;
  root?: Element | null;
  rootMargin?: string;
}) {
  const { once = true, threshold = 0.1, root = null, rootMargin } = options ?? {};
  const [node, setNode] = useState<Element | null>(null);
  const [hasEnteredViewport, setHasEnteredViewport] = useState(false);

  const ref = useCallback((el: Element | null) => setNode(el), []);

  useEffect(() => {
    if (!node || (once && hasEnteredViewport)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry) return;
        if (entry.isIntersecting) {
          setHasEnteredViewport(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setHasEnteredViewport(false);
        }
      },
      { threshold, root, rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, once, hasEnteredViewport, threshold, root, rootMargin]);

  return { ref, hasEnteredViewport };
}
