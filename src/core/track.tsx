import { Profiler, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { RenderPhase } from '../types';
import { usePerfLensContext } from './provider';

interface PerfLensTrackProps {
  /** Label shown in the panel. Keep it stable across renders. */
  name: string;
  children: ReactNode;
}

/**
 * Wraps a subtree with its own Profiler for per-component timing.
 * useRenderTracker counts renders but can't measure duration — React
 * only exposes that through the Profiler component.
 *
 * @param props.name - Identifier for this tracked subtree.
 *
 * @example
 * <PerfLensTrack name="FormBuilder">
 *   <FormBuilder />
 * </PerfLensTrack>
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
        // never crash the host app
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
      // never crash the host app
    }
  };

  return (
    <Profiler id={name} onRender={handleRender}>
      {children}
    </Profiler>
  );
}
