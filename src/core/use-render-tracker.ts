import { useEffect, useRef } from 'react';
import type { UseRenderTrackerOptions } from '../types';
import { usePerfLensContext } from './provider';

/**
 * Tracks render count and mount/unmount for a specific component.
 * Doesn't measure timing — use {@link PerfLensTrack} for that.
 *
 * Side-effect only. Returns nothing. If you need to read perf data,
 * use usePerfLensStore instead.
 *
 * @param componentName - Label shown in the panel.
 * @param options - Per-component overrides.
 */
export function useRenderTracker(
  componentName: string,
  options?: UseRenderTrackerOptions,
): void {
  const { store } = usePerfLensContext();
  const renderCountRef = useRef(0);

  if (options?.ignore) return;

  // record each render — duration is -1 because hooks can't access Profiler data
  // eslint-disable-next-line react-hooks/rules-of-hooks -- ignore flag is stable
  useEffect(() => {
    try {
      store.recordRender(componentName, {
        timestamp: performance.now(),
        phase: renderCountRef.current === 0 ? 'mount' : 'update',
        actualDuration: -1,
        baseDuration: -1,
        startTime: 0,
        commitTime: 0,
        propsChanged: null,
      });
      renderCountRef.current++;
    } catch (_) {
      // never crash the host app
    }
  });

  // cleanup on unmount
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    return () => {
      try {
        store.recordUnmount(componentName);
      } catch (_) {
        // never crash the host app
      }
    };
  }, [store, componentName]);
}

/**
 * Shallow equality check. Same heuristic React.memo uses internally.
 * Exported for use in prop change detection (wired up in v0.3.0).
 */
export function shallowEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key) || a[key] !== b[key]) {
      return false;
    }
  }

  return true;
}
