import { describe, it, expect } from 'vitest';
import { checkAll } from '../../src/analyzer/rules/render-cascade';
import { CircularBuffer } from '../../src/core/circular-buffer';
import type { ComponentPerfData, RenderEvent, PerfLensThresholds } from '../../src/types';
import { DEFAULT_THRESHOLDS } from '../../src/constants';

const NOW = 50_000;
const COMMIT_TIME = 49_500;

function makeEvent(overrides: Partial<RenderEvent> = {}): RenderEvent {
  return {
    timestamp: NOW - 1_000,
    phase: 'update',
    actualDuration: 3,
    baseDuration: 5,
    startTime: 0,
    commitTime: COMMIT_TIME,
    propsChanged: null,
    ...overrides,
  };
}

function makeComponent(
  name: string,
  events: RenderEvent[],
  overrides: Partial<ComponentPerfData> = {},
): ComponentPerfData {
  const buffer = new CircularBuffer<RenderEvent>(200);
  for (const e of events) {
    buffer.push(e);
  }

  return {
    name,
    renderCount: events.length,
    mountCount: 1,
    updateCount: events.length - 1,
    lastDuration: events[events.length - 1]?.actualDuration ?? 0,
    avgDuration: events.reduce((s, e) => s + e.actualDuration, 0) / (events.length || 1),
    maxDuration: Math.max(0, ...events.map((e) => e.actualDuration)),
    totalDuration: events.reduce((s, e) => s + e.actualDuration, 0),
    lastBaseDuration: 5,
    firstRenderAt: NOW - 10_000,
    lastRenderAt: NOW,
    recentRenders: buffer,
    prevProps: null,
    isMounted: true,
    mountUnmountCycles: 0,
    ...overrides,
  };
}

describe('render-cascade rule', () => {
  const thresholds = DEFAULT_THRESHOLDS; // cascadeChildThreshold: 5

  it('returns empty when no components are tracked', () => {
    const components = new Map<string, ComponentPerfData>();
    expect(checkAll(components, thresholds, NOW)).toEqual([]);
  });

  it('returns empty when components render in separate commits', () => {
    const components = new Map([
      ['A', makeComponent('A', [makeEvent({ commitTime: 100 })])],
      ['B', makeComponent('B', [makeEvent({ commitTime: 200 })])],
      ['C', makeComponent('C', [makeEvent({ commitTime: 300 })])],
    ]);

    expect(checkAll(components, thresholds, NOW)).toEqual([]);
  });

  it('returns empty when cascade is below threshold', () => {
    const components = new Map(
      ['A', 'B', 'C', 'D'].map((name) => [name, makeComponent(name, [makeEvent()])]),
    );

    expect(checkAll(components, thresholds, NOW)).toEqual([]);
  });

  it('flags warning when cascade reaches threshold', () => {
    const components = new Map(
      ['A', 'B', 'C', 'D', 'E'].map((name) => [name, makeComponent(name, [makeEvent()])]),
    );

    const insights = checkAll(components, thresholds, NOW);
    expect(insights).toHaveLength(1);
    expect(insights[0]!.severity).toBe('warning');
    expect(insights[0]!.type).toBe('render-cascade');
  });

  it('flags critical when cascade reaches 2x threshold', () => {
    const names = Array.from({ length: 10 }, (_, i) => `Comp${i}`);
    const components = new Map(names.map((name) => [name, makeComponent(name, [makeEvent()])]));

    const insights = checkAll(components, thresholds, NOW);
    expect(insights).toHaveLength(1);
    expect(insights[0]!.severity).toBe('critical');
  });

  it('flags critical when cascade total exceeds 32ms', () => {
    // 5 components, each 8ms = 40ms total > 32ms frame budget
    const components = new Map(
      ['A', 'B', 'C', 'D', 'E'].map((name) => [
        name,
        makeComponent(name, [makeEvent({ actualDuration: 8 })]),
      ]),
    );

    const insights = checkAll(components, thresholds, NOW);
    expect(insights).toHaveLength(1);
    expect(insights[0]!.severity).toBe('critical');
  });

  it('identifies the component with longest render as cascade root', () => {
    const components = new Map([
      ['Fast1', makeComponent('Fast1', [makeEvent({ actualDuration: 1 })])],
      ['Fast2', makeComponent('Fast2', [makeEvent({ actualDuration: 2 })])],
      ['Slow', makeComponent('Slow', [makeEvent({ actualDuration: 20 })])],
      ['Fast3', makeComponent('Fast3', [makeEvent({ actualDuration: 1 })])],
      ['Fast4', makeComponent('Fast4', [makeEvent({ actualDuration: 1 })])],
    ]);

    const insights = checkAll(components, thresholds, NOW);
    expect(insights).toHaveLength(1);
    expect(insights[0]!.componentName).toBe('Slow');
  });

  it('excludes the root from childrenAffected count', () => {
    const components = new Map(
      ['A', 'B', 'C', 'D', 'E'].map((name) => [
        name,
        makeComponent(name, [makeEvent({ actualDuration: 5 })]),
      ]),
    );

    const insight = checkAll(components, thresholds, NOW)[0]!;
    expect(insight.data.type).toBe('render-cascade');
    if (insight.data.type === 'render-cascade') {
      // 5 total components, root excluded = 4 children affected
      expect(insight.data.childrenAffected).toBe(4);
      expect(insight.data.totalCascadeDuration).toBe(25);
    }
  });

  it('ignores mount-phase events', () => {
    const components = new Map(
      ['A', 'B', 'C', 'D', 'E'].map((name) => [
        name,
        makeComponent(name, [makeEvent({ phase: 'mount' })]),
      ]),
    );

    expect(checkAll(components, thresholds, NOW)).toEqual([]);
  });

  it('ignores events with commitTime 0 (hook-only tracking)', () => {
    const components = new Map(
      ['A', 'B', 'C', 'D', 'E'].map((name) => [
        name,
        makeComponent(name, [makeEvent({ commitTime: 0 })]),
      ]),
    );

    expect(checkAll(components, thresholds, NOW)).toEqual([]);
  });

  it('only counts events inside the time window', () => {
    const oldCommitTime = NOW - 15_000;
    const components = new Map(
      ['A', 'B', 'C', 'D', 'E'].map((name) => [
        name,
        makeComponent(name, [makeEvent({ commitTime: oldCommitTime, timestamp: oldCommitTime })]),
      ]),
    );

    expect(checkAll(components, thresholds, NOW)).toEqual([]);
  });

  it('detects multiple cascades from different commits', () => {
    const commit1 = COMMIT_TIME;
    const commit2 = COMMIT_TIME + 500;

    const components = new Map<string, ComponentPerfData>();

    // cascade 1: 5 components
    for (const name of ['A1', 'A2', 'A3', 'A4', 'A5']) {
      components.set(
        name,
        makeComponent(name, [makeEvent({ commitTime: commit1, actualDuration: 3 })]),
      );
    }

    // cascade 2: 6 components with B3 as root
    for (const name of ['B1', 'B2', 'B3', 'B4', 'B5', 'B6']) {
      const duration = name === 'B3' ? 15 : 2;
      components.set(
        name,
        makeComponent(name, [makeEvent({ commitTime: commit2, actualDuration: duration })]),
      );
    }

    const insights = checkAll(components, thresholds, NOW);
    expect(insights).toHaveLength(2);

    const roots = insights.map((i) => i.componentName).sort();
    expect(roots).toContain('B3');
  });

  it('deduplicates — same root only reported once across cascades', () => {
    const commit1 = COMMIT_TIME;
    const commit2 = COMMIT_TIME + 200;

    // Root is the heaviest in both commits
    const components = new Map([
      ['Root', makeComponent('Root', [
        makeEvent({ commitTime: commit1, actualDuration: 10 }),
        makeEvent({ commitTime: commit2, actualDuration: 10 }),
      ])],
      ['A', makeComponent('A', [
        makeEvent({ commitTime: commit1, actualDuration: 2 }),
        makeEvent({ commitTime: commit2, actualDuration: 2 }),
      ])],
      ['B', makeComponent('B', [
        makeEvent({ commitTime: commit1, actualDuration: 2 }),
        makeEvent({ commitTime: commit2, actualDuration: 2 }),
      ])],
      ['C', makeComponent('C', [
        makeEvent({ commitTime: commit1, actualDuration: 2 }),
        makeEvent({ commitTime: commit2, actualDuration: 2 }),
      ])],
      ['D', makeComponent('D', [
        makeEvent({ commitTime: commit1, actualDuration: 2 }),
        makeEvent({ commitTime: commit2, actualDuration: 2 }),
      ])],
    ]);

    const insights = checkAll(components, thresholds, NOW);
    expect(insights).toHaveLength(1);
    expect(insights[0]!.componentName).toBe('Root');
  });

  it('gives context-specific suggestion when cascade blows frame budget', () => {
    // heavy cascade — total over 32ms
    const components = new Map(
      ['A', 'B', 'C', 'D', 'E'].map((name) => [
        name,
        makeComponent(name, [makeEvent({ actualDuration: 8 })]),
      ]),
    );

    const insight = checkAll(components, thresholds, NOW)[0]!;
    expect(insight.suggestion).toContain('context');
    expect(insight.suggestion).toContain('frame budget');
  });

  it('gives memo suggestion for lighter cascades', () => {
    // light cascade — total under 32ms
    const components = new Map(
      ['A', 'B', 'C', 'D', 'E'].map((name) => [
        name,
        makeComponent(name, [makeEvent({ actualDuration: 2 })]),
      ]),
    );

    const insight = checkAll(components, thresholds, NOW)[0]!;
    expect(insight.suggestion).toContain('React.memo');
  });

  it('respects custom thresholds', () => {
    const strict: PerfLensThresholds = {
      ...thresholds,
      cascadeChildThreshold: 3,
    };

    // 3 components — below default (5) but meets strict (3)
    const components = new Map(
      ['A', 'B', 'C'].map((name) => [name, makeComponent(name, [makeEvent()])]),
    );

    expect(checkAll(components, thresholds, NOW)).toEqual([]);
    expect(checkAll(components, strict, NOW)).toHaveLength(1);
  });

  it('generates deterministic insight IDs based on root component', () => {
    const components = new Map(
      ['A', 'B', 'C', 'D', 'E'].map((name) => [
        name,
        makeComponent(name, [makeEvent({ actualDuration: name === 'C' ? 20 : 2 })]),
      ]),
    );

    const id1 = checkAll(components, thresholds, NOW)[0]!.id;
    const id2 = checkAll(components, thresholds, NOW)[0]!.id;

    expect(id1).toBe('render-cascade::C');
    expect(id1).toBe(id2);
  });
});
