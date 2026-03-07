import { useMemo } from 'react';
import { usePerfLensContext } from './provider';
import type { PerfLensStore } from '../types';

/** Read the perf store. Use this for custom UIs or piping data externally. */
export function usePerfLensStore(): PerfLensStore {
  const { store } = usePerfLensContext();

  return useMemo<PerfLensStore>(
    () => ({
      components: store.components,
      get insights() {
        return [...store.insights];
      },
      isEnabled: true,
      startedAt: store.startedAt,
      totalRenders: store.totalRenders,
      clear: () => store.clear(),
      snapshot: () => store.snapshot(),
    }),
    [store],
  );
}
