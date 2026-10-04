import { useRef } from 'react';

/**
 * Beschermt tegen verouderde async-resultaten: `begin()` start een nieuwe fetch,
 * `isCurrent(id)` controleert of dat nog de laatste is voordat state wordt gezet.
 */
export function useFetchGuard() {
  const counter = useRef(0);
  const api = useRef({
    begin: () => ++counter.current,
    isCurrent: (id: number) => id === counter.current,
  });
  return api.current;
}
