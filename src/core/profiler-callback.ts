import type { ProfilerOnRenderCallback } from 'react';
import type { RenderPhase } from '../types';
import type { PerfStore } from './store';

const __DEV__ = process.env.NODE_ENV !== 'production';

/** Creates the onRender callback for React's Profiler. Hot path — keep it lean. */
export function createProfilerCallback(store: PerfStore): ProfilerOnRenderCallback {
  return (
    id,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime,
  ) => {
    try {
      // React 19 added "nested-update" — treat it as update
      const normalizedPhase: RenderPhase = phase === 'mount' ? 'mount' : 'update';

      store.recordRender(id, {
        timestamp: performance.now(),
        phase: normalizedPhase,
        actualDuration,
        baseDuration,
        startTime,
        commitTime,
        propsChanged: null,
      });
    } catch (_err) {
      if (__DEV__) {
        console.warn('[perflens] profiler callback error:', _err);
      }
    }
  };
}
