import { useEffect, useRef } from 'react';
import type { UseRenderTrackerOptions } from '../types';
import { usePerfLensContext } from './provider';

/**
 * Tracks render count for a specific component.
 * Side-effect only — returns nothing.
 *
 * Works standalone (render count + mount/unmount) or alongside
 * PerfLensTrack (which adds Profiler timing on top).
 *
 * @param componentName - Label shown in the panel.
 * @param options - Per-component overrides.
 */
export function useRenderTracker(componentName: string, options?: UseRenderTrackerOptions): void {
  const { store } = usePerfLensContext();
  const renderCountRef = useRef(0);
  const ignore = options?.ignore ?? false;

  // record every render — duration stays 0 since hooks can't access Profiler data.
  // if PerfLensTrack wraps the same component, it'll overwrite with real timing.
  useEffect(() => {
    if (ignore) return;

    try {
      const isMount = renderCountRef.current === 0;
      store.recordRender(componentName, {
        timestamp: performance.now(),
        phase: isMount ? 'mount' : 'update',
        actualDuration: 0,
        baseDuration: 0,
        startTime: 0,
        commitTime: 0,
        propsChanged: null,
      });
      renderCountRef.current++;
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[perflens] render tracking error:', err);
      }
    }
  });

  // cleanup — tell the store when the component unmounts
  useEffect(() => {
    if (ignore) return;

    return () => {
      try {
        store.recordUnmount(componentName);
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[perflens] unmount tracking error:', err);
        }
      }
    };
  }, [store, componentName, ignore]);
}

/** Same check React.memo uses internally. Compares own enumerable keys only. */
export function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
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
