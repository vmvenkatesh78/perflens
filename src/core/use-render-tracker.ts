import { useEffect, useRef } from 'react';
import type { UseRenderTrackerOptions } from '../types';
import { usePerfLensContext } from './provider';

/**
 * Tracks render count and prop changes for a specific component.
 * Side-effect only — returns nothing.
 *
 * Works standalone (render count + mount/unmount) or alongside
 * PerfLensTrack (which adds Profiler timing on top).
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

  // record every render — duration stays 0 since hooks can't access Profiler data.
  // if PerfLensTrack wraps the same component, it'll overwrite with real timing.
  // eslint-disable-next-line react-hooks/rules-of-hooks -- ignore is a static flag, early return is safe
  useEffect(() => {
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
    } catch (_err) {
      // don't crash the host app over a tracking failure
    }
  });

  // prop change detection — also runs every render (no deps)
  // eslint-disable-next-line react-hooks/rules-of-hooks -- same reason as above
  useEffect(() => {
    if (!options?.trackProps) return;

    try {
      const prevProps = store.getPrevProps(componentName);

      if (prevProps !== null) {
        const entry = store.components.get(componentName);
        if (entry) {
          const buffer = entry.recentRenders as unknown as { toArray: () => Array<{ propsChanged: boolean | null }> };
          const recent = buffer.toArray();
          const last = recent[recent.length - 1];
          if (last) {
            last.propsChanged = !shallowEqual(prevProps, getCurrentProps(componentName));
          }
        }
      }
    } catch (_err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[perflens] prop tracking error for <${componentName}>:`, _err);
      }
    }
  });

  // cleanup — tell the store when the component unmounts
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    return () => {
      try {
        store.recordUnmount(componentName);
      } catch (_err) {
        // don't crash the host app over a tracking failure
      }
    };
  }, [store, componentName]);
}

/** Same check React.memo uses internally. Compares own enumerable keys only. */
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

// TODO(v0.3.0): wire up actual prop capture via a ref callback
function getCurrentProps(_name: string): Record<string, unknown> {
  return {};
}
