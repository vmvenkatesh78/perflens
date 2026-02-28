import { usePerfLensContext } from './provider';
import type { PerfLensStore } from '../types';

/** Read the perf store. Use this for custom UIs or piping data externally. */
export function usePerfLensStore(): PerfLensStore {
  const { store } = usePerfLensContext();

  return {
    components: store.components,
    insights: store.insights,
    isEnabled: true,
    startedAt: store.startedAt,
    totalRenders: store.totalRenders,
    clear: () => store.clear(),
    snapshot: () => store.snapshot(),
  };
}
