import { Profiler, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { RenderPhase } from '../types';
import { usePerfLensContext } from './provider';

interface PerfLensTrackProps {
  /** Label shown in the panel. Keep it stable — changing this creates a new entry. */
  name: string;
  children: ReactNode;
}

/**
 * Wraps a subtree with its own Profiler for per-component timing.
 * useRenderTracker can count renders and detect prop changes, but
 * only a Profiler gives you actual render duration.
 *
 * Use from the parent:
 *   <PerfLensTrack name="FormBuilder">
 *     <FormBuilder />
 *   </PerfLensTrack>
 */
export function PerfLensTrack({ name, children }: PerfLensTrackProps) {
  const { store } = usePerfLensContext();
  const mountedRef = useRef(false);

  // track unmount so the store knows this component is gone
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      try {
        store.recordUnmount(name);
      } catch (_) {
        // never crash the host app — perflens is a dev tool, not critical path
      }
    };
  }, [store, name]);

  const handleRender = (
    _id: string,
    phase: 'mount' | 'update' | 'nested-update',
    actualDuration: number,
    baseDuration: number,
    startTime: number,
    commitTime: number,
  ) => {
    try {
      // React 19 added 'nested-update' — we just bucket it as 'update'
      const normalizedPhase: RenderPhase = phase === 'mount' ? 'mount' : 'update';
      store.recordRender(name, {
        timestamp: performance.now(),
        phase: normalizedPhase,
        actualDuration,
        baseDuration,
        startTime,
        commitTime,
        propsChanged: null,
      });
    } catch (_) {
      // same deal — don't blow up the app for a perf tracking failure
    }
  };

  return (
    <Profiler id={name} onRender={handleRender}>
      {children}
    </Profiler>
  );
}
