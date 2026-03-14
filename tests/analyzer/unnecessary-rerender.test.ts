import { describe, it, expect } from 'vitest';
import { check } from '../../src/analyzer/rules/unnecessary-rerender';
import { CircularBuffer } from '../../src/core/circular-buffer';
import type { ComponentPerfData, RenderEvent, PerfLensThresholds } from '../../src/types';
import { DEFAULT_THRESHOLDS } from '../../src/constants';

const NOW = 50_000;

function makeEvent(timestamp: number, overrides: Partial<RenderEvent> = {}): RenderEvent {
  return {
    timestamp,
    phase: 'update',
    actualDuration: 2,
    baseDuration: 4,
    startTime: 0,
    commitTime: 0,
    propsChanged: null,
    ...overrides,
  };
}

function makeComponent(
  events: RenderEvent[],
  overrides: Partial<ComponentPerfData> = {},
): ComponentPerfData {
  const buffer = new CircularBuffer<RenderEvent>(200);
  for (const e of events) {
    buffer.push(e);
  }

  return {
    name: 'TestComp',
    renderCount: events.length,
    mountCount: 1,
    updateCount: events.length - 1,
    lastDuration: 2,
    avgDuration: 2,
    maxDuration: 5,
    totalDuration: events.length * 2,
    lastBaseDuration: 4,
    firstRenderAt: NOW - 10_000,
    lastRenderAt: NOW,
    recentRenders: buffer,
    prevProps: null,
    isMounted: true,
    mountUnmountCycles: 0,
    ...overrides,
  };
}

describe('unnecessary-rerender rule', () => {
  const thresholds = DEFAULT_THRESHOLDS;

  it('does not flag when prop tracking is not enabled', () => {
    // all events have propsChanged: null — no tracking
    const events = Array.from({ length: 10 }, (_, i) => makeEvent(NOW - 5_000 + i * 100));
    const data = makeComponent(events);
    expect(check('NoTracking', data, thresholds, NOW)).toEqual([]);
  });

  it('does not flag when under minimum render count', () => {
    // only 3 tracked updates — below default minCount of 5
    const events = [
      makeEvent(NOW - 3000, { propsChanged: false }),
      makeEvent(NOW - 2000, { propsChanged: false }),
      makeEvent(NOW - 1000, { propsChanged: false }),
    ];
    const data = makeComponent(events);
    expect(check('TooFew', data, thresholds, NOW)).toEqual([]);
  });

  it('does not flag when most renders have props changed', () => {
    // 8 renders, 6 with props changed, 2 without — 25% unnecessary
    const events = Array.from({ length: 8 }, (_, i) =>
      makeEvent(NOW - 4_000 + i * 100, {
        propsChanged: i < 6, // first 6 had props change, last 2 didn't
      }),
    );
    const data = makeComponent(events);
    expect(check('MostlyNecessary', data, thresholds, NOW)).toEqual([]);
  });

  it('flags warning when ratio exceeds threshold', () => {
    // 10 renders, 6 unnecessary — 60%
    const events = Array.from({ length: 10 }, (_, i) =>
      makeEvent(NOW - 5_000 + i * 100, {
        propsChanged: i < 4, // first 4 had changes, last 6 didn't
      }),
    );
    const data = makeComponent(events);
    const insights = check('Wasteful', data, thresholds, NOW);

    expect(insights).toHaveLength(1);
    expect(insights[0]!.severity).toBe('warning');
    expect(insights[0]!.type).toBe('unnecessary-rerender');
    expect(insights[0]!.componentName).toBe('Wasteful');
  });

  it('flags critical when ratio exceeds 75%', () => {
    // 10 renders, 8 unnecessary — 80%
    const events = Array.from({ length: 10 }, (_, i) =>
      makeEvent(NOW - 5_000 + i * 100, {
        propsChanged: i < 2, // only first 2 had changes
      }),
    );
    const data = makeComponent(events);
    const insights = check('VeryWasteful', data, thresholds, NOW);

    expect(insights).toHaveLength(1);
    expect(insights[0]!.severity).toBe('critical');
  });

  it('ignores mount-phase events', () => {
    // mount events should not count as unnecessary
    const events = [
      makeEvent(NOW - 5000, { phase: 'mount', propsChanged: null }),
      ...Array.from({ length: 4 }, (_, i) =>
        makeEvent(NOW - 4_000 + i * 100, { propsChanged: false }),
      ),
    ];
    const data = makeComponent(events);
    // only 4 tracked updates — below minCount of 5
    expect(check('WithMount', data, thresholds, NOW)).toEqual([]);
  });

  it('ignores events where propsChanged is null in a mixed set', () => {
    // mix of tracked and untracked — only count tracked ones
    const events = [
      makeEvent(NOW - 5000, { propsChanged: null }), // untracked
      makeEvent(NOW - 4000, { propsChanged: null }), // untracked
      makeEvent(NOW - 3000, { propsChanged: false }), // unnecessary
      makeEvent(NOW - 2500, { propsChanged: false }), // unnecessary
      makeEvent(NOW - 2000, { propsChanged: false }), // unnecessary
      makeEvent(NOW - 1500, { propsChanged: false }), // unnecessary
      makeEvent(NOW - 1000, { propsChanged: false }), // unnecessary
      makeEvent(NOW - 500, { propsChanged: true }), // necessary
    ];
    const data = makeComponent(events);
    const insights = check('Mixed', data, thresholds, NOW);

    // 6 tracked updates: 5 unnecessary, 1 necessary = 83%
    expect(insights).toHaveLength(1);
    expect(insights[0]!.severity).toBe('critical');
  });

  it('calculates wasted milliseconds from actualDuration', () => {
    const events = Array.from({ length: 8 }, (_, i) =>
      makeEvent(NOW - 4_000 + i * 100, {
        propsChanged: i < 2,
        actualDuration: 5, // 5ms each
      }),
    );
    const data = makeComponent(events);
    const insight = check('WithTiming', data, thresholds, NOW)[0]!;

    expect(insight.data.type).toBe('unnecessary-rerender');
    if (insight.data.type === 'unnecessary-rerender') {
      expect(insight.data.totalUnnecessary).toBe(6);
      expect(insight.data.totalRenders).toBe(8);
      expect(insight.data.wastedMs).toBe(30); // 6 * 5ms
    }
  });

  it('generates deterministic insight IDs', () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      makeEvent(NOW - 5_000 + i * 100, { propsChanged: false }),
    );
    const data = makeComponent(events);
    const id1 = check('Stable', data, thresholds, NOW)[0]!.id;
    const id2 = check('Stable', data, thresholds, NOW)[0]!.id;

    expect(id1).toBe('unnecessary-rerender::Stable');
    expect(id1).toBe(id2);
  });

  it('respects custom thresholds', () => {
    const strict: PerfLensThresholds = {
      ...thresholds,
      unnecessaryRerenderRatio: 30,
      unnecessaryRerenderMinCount: 3,
    };

    // 5 renders, 2 unnecessary — 40% (above strict 30% threshold)
    const events = Array.from({ length: 5 }, (_, i) =>
      makeEvent(NOW - 2_000 + i * 100, {
        propsChanged: i < 3,
      }),
    );
    const data = makeComponent(events);

    // wouldn't trigger default (50%), but triggers strict (30%)
    expect(check('Strict', data, thresholds, NOW)).toEqual([]);
    expect(check('Strict', data, strict, NOW)).toHaveLength(1);
  });

  it('only counts events inside the time window', () => {
    // old unnecessary renders outside the window, recent ones are fine
    const events = [
      // old — outside 10s window
      ...Array.from({ length: 8 }, (_, i) =>
        makeEvent(NOW - 15_000 + i * 100, { propsChanged: false }),
      ),
      // recent — inside window, all necessary
      ...Array.from({ length: 6 }, (_, i) =>
        makeEvent(NOW - 3_000 + i * 100, { propsChanged: true }),
      ),
    ];
    const data = makeComponent(events);
    // recent window has 6 necessary renders — should not flag
    expect(check('RecentlyFixed', data, thresholds, NOW)).toEqual([]);
  });
});
