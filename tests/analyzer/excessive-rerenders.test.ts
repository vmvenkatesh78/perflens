import { describe, it, expect } from 'vitest';
import { check } from '../../src/analyzer/rules/excessive-rerenders';
import { CircularBuffer } from '../../src/core/circular-buffer';
import type { ComponentPerfData, RenderEvent, PerfLensThresholds } from '../../src/types';
import { DEFAULT_THRESHOLDS } from '../../src/constants';

const NOW = 50_000; // fixed "current time" so tests are deterministic

function makeEvent(timestamp: number): RenderEvent {
  return {
    timestamp,
    phase: 'update',
    actualDuration: 2,
    baseDuration: 4,
    startTime: 0,
    commitTime: 0,
    propsChanged: null,
  };
}

/**
 * Builds a component with N render events spread evenly across the
 * time window ending at NOW. Gives us precise control over render rate.
 */
function makeComponent(
  renderCount: number,
  windowMs: number,
  overrides: Partial<ComponentPerfData> = {},
): ComponentPerfData {
  const buffer = new CircularBuffer<RenderEvent>(200);
  const windowStart = NOW - windowMs;

  for (let i = 0; i < renderCount; i++) {
    // spread events evenly across the window
    const t = windowStart + (windowMs / renderCount) * (i + 1);
    buffer.push(makeEvent(t));
  }

  return {
    name: 'TestComp',
    renderCount,
    mountCount: 1,
    updateCount: renderCount - 1,
    lastDuration: 2,
    avgDuration: 2,
    maxDuration: 5,
    totalDuration: renderCount * 2,
    lastBaseDuration: 4,
    firstRenderAt: NOW - windowMs,
    lastRenderAt: NOW,
    recentRenders: buffer,
    prevProps: null,
    isMounted: true,
    mountUnmountCycles: 0,
    ...overrides,
  };
}

describe('excessive-rerenders rule', () => {
  const thresholds = DEFAULT_THRESHOLDS; // count: 20, window: 10_000ms

  it('does not flag components under the threshold', () => {
    const data = makeComponent(10, 10_000);
    expect(check('Chill', data, thresholds, NOW)).toEqual([]);
  });

  it('does not flag exactly at threshold minus one', () => {
    const data = makeComponent(19, 10_000);
    expect(check('AlmostHot', data, thresholds, NOW)).toEqual([]);
  });

  it('flags warning at the threshold', () => {
    const data = makeComponent(20, 10_000);
    const insights = check('GettingHot', data, thresholds, NOW);

    expect(insights).toHaveLength(1);
    expect(insights[0]!.severity).toBe('warning');
    expect(insights[0]!.type).toBe('excessive-rerenders');
    expect(insights[0]!.componentName).toBe('GettingHot');
  });

  it('flags critical at 2x threshold', () => {
    const data = makeComponent(40, 10_000);
    const insights = check('TooHot', data, thresholds, NOW);

    expect(insights).toHaveLength(1);
    expect(insights[0]!.severity).toBe('critical');
  });

  it('only counts renders inside the time window', () => {
    // 30 total renders, but 20 of them are outside the window
    const buffer = new CircularBuffer<RenderEvent>(200);

    // 20 old renders — outside the 10s window
    for (let i = 0; i < 20; i++) {
      buffer.push(makeEvent(NOW - 15_000 + i * 100));
    }
    // 10 recent renders — inside the window
    for (let i = 0; i < 10; i++) {
      buffer.push(makeEvent(NOW - 5_000 + i * 100));
    }

    const data = makeComponent(30, 10_000, {
      recentRenders: buffer,
    });

    // only 10 in window, threshold is 20 — should not flag
    expect(check('MostlyOld', data, thresholds, NOW)).toEqual([]);
  });

  it('calculates renders per second correctly', () => {
    // 50 renders in 10s = 5/sec
    const data = makeComponent(50, 10_000);
    const insight = check('Counter', data, thresholds, NOW)[0]!;

    expect(insight.data.type).toBe('excessive-rerenders');
    if (insight.data.type === 'excessive-rerenders') {
      expect(insight.data.rendersPerSecond).toBe(5);
      expect(insight.data.renderCount).toBe(50);
      expect(insight.data.timeWindowMs).toBe(10_000);
    }
  });

  it('gives different suggestion for very high render rates', () => {
    // >10/sec gets the "faster than screens refresh" suggestion
    const fast = makeComponent(150, 10_000); // 15/sec
    const moderate = makeComponent(25, 10_000); // 2.5/sec

    const fastSuggestion = check('Fast', fast, thresholds, NOW)[0]!.suggestion;
    const modSuggestion = check('Mod', moderate, thresholds, NOW)[0]!.suggestion;

    expect(fastSuggestion).toContain('setState');
    expect(modSuggestion).toContain('React.memo');
  });

  it('generates deterministic insight IDs', () => {
    const data = makeComponent(30, 10_000);
    const id1 = check('Ticker', data, thresholds, NOW)[0]!.id;
    const id2 = check('Ticker', data, thresholds, NOW)[0]!.id;

    expect(id1).toBe('excessive-rerenders::Ticker');
    expect(id1).toBe(id2);
  });

  it('respects custom thresholds', () => {
    const strict: PerfLensThresholds = {
      ...thresholds,
      excessiveRenderCount: 5,
      excessiveRenderWindow: 2_000,
    };

    // 6 renders in 2s — wouldn't trigger defaults, but should trigger strict
    const buffer = new CircularBuffer<RenderEvent>(200);
    for (let i = 0; i < 6; i++) {
      buffer.push(makeEvent(NOW - 1_000 + i * 100));
    }

    const data = makeComponent(6, 2_000, {
      recentRenders: buffer,
    });

    expect(check('Strict', data, strict, NOW)).toHaveLength(1);
  });
});
