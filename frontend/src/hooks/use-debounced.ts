"use client";

import { useEffect, useState } from "react";

/** Valor com atraso: evita uma chamada à API a cada tecla digitada na busca. */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
