import { describe, it, expect } from 'vitest';
import { check } from '../../src/analyzer/rules/slow-render';
import type { ComponentPerfData, PerfLensThresholds } from '../../src/types';
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
    recentRenders: [],
    prevProps: null,
    isMounted: true,
    mountUnmountCycles: 0,
    ...overrides,
  };
}

describe('slow-render rule', () => {
  const thresholds = DEFAULT_THRESHOLDS; // slowRenderMs = 16

  it('does not flag components under the threshold', () => {
    const data = makeComponent({ avgDuration: 8 });
    expect(check('FastComp', data, thresholds)).toEqual([]);
  });

  it('does not flag components with only 1 render', () => {
    // one mount render could just be expensive initialization, not a pattern
    const data = makeComponent({ renderCount: 1, avgDuration: 30 });
    expect(check('OneShot', data, thresholds)).toEqual([]);
  });

  it('does not flag hook-only tracking (avgDuration = 0)', () => {
    const data = makeComponent({ avgDuration: 0, renderCount: 20 });
    expect(check('HookOnly', data, thresholds)).toEqual([]);
  });

  it('flags warning for components over threshold but under 2x', () => {
    const data = makeComponent({ avgDuration: 22, maxDuration: 28 });
    const insights = check('SlowCard', data, thresholds);

    expect(insights).toHaveLength(1);
    expect(insights[0]!.severity).toBe('warning');
    expect(insights[0]!.type).toBe('slow-render');
    expect(insights[0]!.componentName).toBe('SlowCard');
    expect(insights[0]!.data.type).toBe('slow-render');
  });

  it('flags critical for components at 2x or more over threshold', () => {
    // 35ms avg, threshold is 16ms, 2x = 32ms → critical
    const data = makeComponent({ avgDuration: 35, maxDuration: 50 });
    const insights = check('HeavyTable', data, thresholds);

    expect(insights).toHaveLength(1);
    expect(insights[0]!.severity).toBe('critical');
  });

  it('uses the exact 2x boundary correctly', () => {
    // exactly 32ms = 2x of 16ms → critical
    const data = makeComponent({ avgDuration: 32 });
    expect(check('Boundary', data, thresholds)[0]!.severity).toBe('critical');

    // 31.9ms → still warning
    const data2 = makeComponent({ avgDuration: 31.9 });
    expect(check('AlmostCritical', data2, thresholds)[0]!.severity).toBe('warning');
  });

  it('includes correct data payload', () => {
    const data = makeComponent({ avgDuration: 20, maxDuration: 45 });
    const insight = check('Chart', data, thresholds)[0]!;

    expect(insight.data).toEqual({
      type: 'slow-render',
      avgDuration: 20,
      maxDuration: 45,
      frameBudgetMs: 16,
    });
  });

  it('generates deterministic insight IDs', () => {
    const data = makeComponent({ avgDuration: 20 });
    const id1 = check('Widget', data, thresholds)[0]!.id;
    const id2 = check('Widget', data, thresholds)[0]!.id;

    expect(id1).toBe(id2);
    expect(id1).toBe('slow-render::Widget');
  });

  it('gives different suggestion for extreme max durations', () => {
    // max > 3x threshold (48ms+) → suggests heavy operation in render path
    const mild = makeComponent({ avgDuration: 20, maxDuration: 25 });
    const extreme = makeComponent({ avgDuration: 20, maxDuration: 60 });

    const mildSuggestion = check('Mild', mild, thresholds)[0]!.suggestion;
    const extremeSuggestion = check('Extreme', extreme, thresholds)[0]!.suggestion;

    expect(extremeSuggestion).toContain('useMemo');
    expect(mildSuggestion).not.toContain('useMemo');
  });

  it('respects custom thresholds', () => {
    const strict: PerfLensThresholds = { ...thresholds, slowRenderMs: 4 };
    const data = makeComponent({ avgDuration: 5 });

    // 5ms wouldn't flag at default 16ms, but should at 4ms
    expect(check('Strict', data, strict)).toHaveLength(1);
  });
});
