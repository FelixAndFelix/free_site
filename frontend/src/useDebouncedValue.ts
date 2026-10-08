import { useEffect, useState } from "react";

/**
 * Returns the value only after it has stayed the same for a moment, so typing in a search box
 * does not send a request for every letter.
 * @param {T} value
 * @param {number} delayMs
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
