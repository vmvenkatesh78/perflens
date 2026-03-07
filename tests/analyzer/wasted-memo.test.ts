import { describe, it, expect } from 'vitest';
import { check } from '../../src/analyzer/rules/wasted-memo';
import type { ComponentPerfData, PerfLensThresholds } from '../../src/types';
import { CircularBuffer } from '../../src/core/circular-buffer';
import { DEFAULT_THRESHOLDS } from '../../src/constants';

function makeComponent(overrides: Partial<ComponentPerfData> = {}): ComponentPerfData {
  return {
    name: 'TestComp',
    renderCount: 10,
    mountCount: 1,
    updateCount: 9,
    lastDuration: 5,
    avgDuration: 5,
    maxDuration: 8,
    totalDuration: 50,
    lastBaseDuration: 10,
    firstRenderAt: 0,
    lastRenderAt: 100,
    recentRenders: new CircularBuffer(100),
    prevProps: null,
    isMounted: true,
    mountUnmountCycles: 0,
    ...overrides,
  };
}

describe('wasted-memo rule', () => {
  const thresholds = DEFAULT_THRESHOLDS; // memoSavingsThreshold: 10

  it('does not flag when memo saves more than the threshold', () => {
    // avgDuration=5, baseDuration=10 → 50% savings, well above 10%
    const data = makeComponent({ avgDuration: 5, lastBaseDuration: 10 });
    expect(check('Efficient', data, thresholds)).toEqual([]);
  });

  it('does not flag hook-only tracking (no Profiler data)', () => {
    const data = makeComponent({ avgDuration: 0, lastBaseDuration: 0 });
    expect(check('HookOnly', data, thresholds)).toEqual([]);
  });

  it('does not flag with too few renders', () => {
    // need at least 3 renders to spot a pattern
    const data = makeComponent({ renderCount: 2, avgDuration: 9, lastBaseDuration: 10 });
    expect(check('TooFresh', data, thresholds)).toEqual([]);
  });

  it('flags warning when savings are below threshold', () => {
    // avgDuration=9.5, baseDuration=10 → 5% savings, under 10%
    const data = makeComponent({ avgDuration: 9.5, lastBaseDuration: 10 });
    const insights = check('Wasteful', data, thresholds);

    expect(insights).toHaveLength(1);
    expect(insights[0]!.severity).toBe('warning');
    expect(insights[0]!.type).toBe('wasted-memo');
  });

  it('flags info for trivial components (both under 1ms)', () => {
    // savings = (0.4-0.38)/0.4 = 5% — under threshold, AND both under 1ms
    const data = makeComponent({
      avgDuration: 0.38,
      lastBaseDuration: 0.4,
      renderCount: 20,
    });
    const insights = check('TinyLabel', data, thresholds);

    expect(insights).toHaveLength(1);
    expect(insights[0]!.severity).toBe('info');
    expect(insights[0]!.title).toContain('<1ms');
  });

  it('flags warning not info when component is non-trivial but low savings', () => {
    // 5ms avg, 5.2ms base → ~3.8% savings, but component isn't trivial
    const data = makeComponent({ avgDuration: 5, lastBaseDuration: 5.2 });
    const insights = check('MediumComp', data, thresholds);

    expect(insights).toHaveLength(1);
    expect(insights[0]!.severity).toBe('warning');
  });

  it('clamps negative savings to 0', () => {
    // actual > base can happen after a heavy re-render spike
    const data = makeComponent({ avgDuration: 12, lastBaseDuration: 10 });
    const insight = check('Spiked', data, thresholds)[0]!;

    expect(insight.data.type).toBe('wasted-memo');
    if (insight.data.type === 'wasted-memo') {
      expect(insight.data.savingsPercent).toBe(0);
    }
  });

  it('includes correct data payload', () => {
    // avgDuration=9.5, baseDuration=10 → 5% savings → triggers rule
    const data = makeComponent({ avgDuration: 9.5, lastBaseDuration: 10 });
    const insight = check('Widget', data, thresholds)[0]!;

    expect(insight.data).toEqual({
      type: 'wasted-memo',
      actualDuration: 9.5,
      baseDuration: 10,
      savingsPercent: 5,
    });
  });

  it('handles exactly at the threshold — should NOT flag', () => {
    // savings = exactly 10% → meets threshold → no insight
    const data = makeComponent({ avgDuration: 9, lastBaseDuration: 10 });
    expect(check('Borderline', data, thresholds)).toEqual([]);
  });

  it('handles just under the threshold — should flag', () => {
    // savings = 9.9% → under 10% → flag
    const data = makeComponent({ avgDuration: 9.01, lastBaseDuration: 10 });
    expect(check('JustUnder', data, thresholds)).toHaveLength(1);
  });

  it('respects custom thresholds', () => {
    const strict: PerfLensThresholds = { ...thresholds, memoSavingsThreshold: 30 };
    // 20% savings — fine at default 10%, but below strict 30%
    const data = makeComponent({ avgDuration: 8, lastBaseDuration: 10 });

    expect(check('Strict', data, strict)).toHaveLength(1);
  });

  it('suggestion differs for trivial vs non-trivial', () => {
    const trivial = makeComponent({
      avgDuration: 0.38,
      lastBaseDuration: 0.4,
      renderCount: 10,
    });
    const heavy = makeComponent({ avgDuration: 9.5, lastBaseDuration: 10 });

    const trivialSuggestion = check('Trivial', trivial, thresholds)[0]!.suggestion;
    const heavySuggestion = check('Heavy', heavy, thresholds)[0]!.suggestion;

    expect(trivialSuggestion).toContain('Remove React.memo');
    expect(heavySuggestion).toContain('useCallback');
  });
});
