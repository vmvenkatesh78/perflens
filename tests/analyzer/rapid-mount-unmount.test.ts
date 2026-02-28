import { describe, it, expect } from 'vitest';
import { check } from '../../src/analyzer/rules/rapid-mount-unmount';
import { CircularBuffer } from '../../src/core/circular-buffer';
import type { ComponentPerfData, RenderEvent, PerfLensThresholds } from '../../src/types';
import { DEFAULT_THRESHOLDS } from '../../src/constants';

const NOW = 50_000;

function makeEvent(timestamp: number, phase: 'mount' | 'update' = 'update'): RenderEvent {
  return {
    timestamp,
    phase,
    actualDuration: 2,
    baseDuration: 4,
    startTime: 0,
    commitTime: 0,
    propsChanged: null,
  };
}

/**
 * Builds a component with a mix of mount and update events.
 * mountCount controls how many mount-phase events land in the buffer
 * within the time window.
 */
function makeComponent(
  mountCount: number,
  updatesPerMount: number,
  windowMs: number,
): ComponentPerfData {
  const buffer = new CircularBuffer<RenderEvent>(200);
  const windowStart = NOW - windowMs;
  const totalEvents = mountCount * (1 + updatesPerMount);
  const gap = windowMs / totalEvents;

  let t = windowStart;
  for (let m = 0; m < mountCount; m++) {
    // mount event
    t += gap;
    buffer.push(makeEvent(t, 'mount'));
    // followed by some updates
    for (let u = 0; u < updatesPerMount; u++) {
      t += gap;
      buffer.push(makeEvent(t, 'update'));
    }
  }

  return {
    name: 'TestComp',
    renderCount: totalEvents,
    mountCount,
    updateCount: totalEvents - mountCount,
    lastDuration: 2,
    avgDuration: 2,
    maxDuration: 5,
    totalDuration: totalEvents * 2,
    lastBaseDuration: 4,
    firstRenderAt: windowStart,
    lastRenderAt: NOW,
    recentRenders: buffer as unknown as RenderEvent[],
    prevProps: null,
    isMounted: true,
    mountUnmountCycles: mountCount - 1,
  };
}

describe('rapid-mount-unmount rule', () => {
  const thresholds = DEFAULT_THRESHOLDS; // cycles: 5, window: 5_000ms

  it('does not flag stable components', () => {
    // 1 mount, 20 updates — totally normal
    const data = makeComponent(1, 20, 5_000);
    expect(check('Stable', data, thresholds, NOW)).toEqual([]);
  });

  it('does not flag just under the threshold', () => {
    // 4 mounts in 5s — one short of the threshold
    const data = makeComponent(4, 2, 5_000);
    expect(check('AlmostFlickery', data, thresholds, NOW)).toEqual([]);
  });

  it('flags warning at the threshold', () => {
    const data = makeComponent(5, 1, 5_000);
    const insights = check('Flickery', data, thresholds, NOW);

    expect(insights).toHaveLength(1);
    expect(insights[0]!.severity).toBe('warning');
    expect(insights[0]!.type).toBe('rapid-mount-unmount');
  });

  it('flags critical at 2x threshold', () => {
    const data = makeComponent(10, 0, 5_000);
    const insights = check('VeryFlickery', data, thresholds, NOW);

    expect(insights).toHaveLength(1);
    expect(insights[0]!.severity).toBe('critical');
  });

  it('only counts mounts inside the time window', () => {
    const buffer = new CircularBuffer<RenderEvent>(200);

    // 8 mounts outside the window
    for (let i = 0; i < 8; i++) {
      buffer.push(makeEvent(NOW - 10_000 + i * 100, 'mount'));
    }
    // 3 mounts inside the window — under threshold
    for (let i = 0; i < 3; i++) {
      buffer.push(makeEvent(NOW - 2_000 + i * 100, 'mount'));
    }

    const data: ComponentPerfData = {
      name: 'MostlyOld',
      renderCount: 11,
      mountCount: 11,
      updateCount: 0,
      lastDuration: 2,
      avgDuration: 2,
      maxDuration: 5,
      totalDuration: 22,
      lastBaseDuration: 4,
      firstRenderAt: NOW - 10_000,
      lastRenderAt: NOW,
      recentRenders: buffer as unknown as RenderEvent[],
      prevProps: null,
      isMounted: true,
      mountUnmountCycles: 10,
    };

    expect(check('MostlyOld', data, thresholds, NOW)).toEqual([]);
  });

  it('ignores update events when counting', () => {
    // 3 mounts + 50 updates — lots of renders but only 3 mounts
    const data = makeComponent(3, 16, 5_000);
    expect(check('Chatty', data, thresholds, NOW)).toEqual([]);
  });

  it('includes correct data payload', () => {
    const data = makeComponent(7, 1, 5_000);
    const insight = check('Widget', data, thresholds, NOW)[0]!;

    expect(insight.data).toEqual({
      type: 'rapid-mount-unmount',
      cycles: 7,
      timeWindowMs: 5_000,
      cyclesPerSecond: 1.4,
    });
  });

  it('suggestion mentions key props', () => {
    const data = makeComponent(6, 0, 5_000);
    const insight = check('Keyed', data, thresholds, NOW)[0]!;

    expect(insight.suggestion).toContain('key');
  });

  it('respects custom thresholds', () => {
    const strict: PerfLensThresholds = {
      ...thresholds,
      rapidMountCycles: 2,
      rapidMountWindow: 1_000,
    };

    const buffer = new CircularBuffer<RenderEvent>(200);
    buffer.push(makeEvent(NOW - 500, 'mount'));
    buffer.push(makeEvent(NOW - 200, 'mount'));

    const data: ComponentPerfData = {
      name: 'Quick',
      renderCount: 2,
      mountCount: 2,
      updateCount: 0,
      lastDuration: 2,
      avgDuration: 2,
      maxDuration: 2,
      totalDuration: 4,
      lastBaseDuration: 4,
      firstRenderAt: NOW - 500,
      lastRenderAt: NOW - 200,
      recentRenders: buffer as unknown as RenderEvent[],
      prevProps: null,
      isMounted: true,
      mountUnmountCycles: 1,
    };

    expect(check('Quick', data, strict, NOW)).toHaveLength(1);
  });
});
