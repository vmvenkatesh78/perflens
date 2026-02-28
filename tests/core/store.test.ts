import { describe, it, expect, beforeEach } from 'vitest';
import { PerfStore } from '../../src/core/store';
import type { RenderEvent } from '../../src/types';

function makeEvent(overrides: Partial<RenderEvent> = {}): RenderEvent {
  return {
    timestamp: performance.now(),
    phase: 'update',
    actualDuration: 5,
    baseDuration: 10,
    startTime: 0,
    commitTime: 1,
    propsChanged: null,
    ...overrides,
  };
}

describe('PerfStore', () => {
  let store: PerfStore;

  beforeEach(() => {
    store = new PerfStore(200, 100);
  });

  it('creates entry on first render', () => {
    store.recordRender('UserList', makeEvent({ phase: 'mount' }));

    expect(store.components.has('UserList')).toBe(true);

    const entry = store.components.get('UserList')!;
    expect(entry.renderCount).toBe(1);
    expect(entry.mountCount).toBe(1);
    expect(entry.updateCount).toBe(0);
    expect(entry.isMounted).toBe(true);
  });

  it('increments counters on subsequent renders', () => {
    store.recordRender('Card', makeEvent({ phase: 'mount' }));
    store.recordRender('Card', makeEvent({ phase: 'update', actualDuration: 3 }));
    store.recordRender('Card', makeEvent({ phase: 'update', actualDuration: 7 }));

    const entry = store.components.get('Card')!;
    expect(entry.renderCount).toBe(3);
    expect(entry.mountCount).toBe(1);
    expect(entry.updateCount).toBe(2);
  });

  it('computes running average', () => {
    store.recordRender('Box', makeEvent({ actualDuration: 4 }));
    store.recordRender('Box', makeEvent({ actualDuration: 8 }));

    const entry = store.components.get('Box')!;
    expect(entry.avgDuration).toBe(6);
    expect(entry.totalDuration).toBe(12);
  });

  it('tracks max duration', () => {
    store.recordRender('List', makeEvent({ actualDuration: 2 }));
    store.recordRender('List', makeEvent({ actualDuration: 20 }));
    store.recordRender('List', makeEvent({ actualDuration: 5 }));

    expect(store.components.get('List')!.maxDuration).toBe(20);
  });

  it('records unmount', () => {
    store.recordRender('Modal', makeEvent({ phase: 'mount' }));
    store.recordUnmount('Modal');

    const entry = store.components.get('Modal')!;
    expect(entry.isMounted).toBe(false);
    expect(entry.mountUnmountCycles).toBe(1);
  });

  it('handles unmount for unknown component', () => {
    // shouldn't throw
    store.recordUnmount('DoesNotExist');
  });

  it('evicts oldest component at capacity', () => {
    const small = new PerfStore(3, 10);

    small.recordRender('A', makeEvent({ phase: 'mount' }));
    small.recordRender('B', makeEvent({ phase: 'mount' }));
    small.recordRender('C', makeEvent({ phase: 'mount' }));

    // touch A so B becomes oldest
    small.recordRender('A', makeEvent());

    // D should evict B
    small.recordRender('D', makeEvent({ phase: 'mount' }));

    expect(small.components.has('A')).toBe(true);
    expect(small.components.has('B')).toBe(false);
    expect(small.components.has('C')).toBe(true);
    expect(small.components.has('D')).toBe(true);
  });

  it('tracks total renders across components', () => {
    store.recordRender('A', makeEvent());
    store.recordRender('B', makeEvent());
    store.recordRender('A', makeEvent());

    expect(store.totalRenders).toBe(3);
  });

  it('clears everything', () => {
    store.recordRender('X', makeEvent());
    store.recordRender('Y', makeEvent());
    store.clear();

    expect(store.components.size).toBe(0);
    expect(store.totalRenders).toBe(0);
    expect(store.insights).toEqual([]);
  });

  it('produces a JSON-serializable snapshot', () => {
    store.recordRender('Nav', makeEvent({ phase: 'mount', actualDuration: 3 }));

    const snap = store.snapshot();

    expect(snap.components).toHaveLength(1);
    expect(snap.components[0]!.name).toBe('Nav');
    expect(snap.metadata.totalRenders).toBe(1);
    expect(snap.metadata.perflensVersion).toBeDefined();
    expect(Array.isArray(snap.components[0]!.recentRenders)).toBe(true);
    expect(() => JSON.stringify(snap)).not.toThrow();
  });

  it('stores and retrieves previous props', () => {
    store.recordRender('Btn', makeEvent({ phase: 'mount' }));
    store.storeProps('Btn', { label: 'click', disabled: false });

    expect(store.getPrevProps('Btn')).toEqual({ label: 'click', disabled: false });
  });

  it('returns null for props on unknown component', () => {
    expect(store.getPrevProps('Ghost')).toBeNull();
  });

  it('skips duration updates for hook-level renders (actualDuration = -1)', () => {
    // PerfLensTrack render with real timing
    store.recordRender('Btn', makeEvent({ phase: 'mount', actualDuration: 5, baseDuration: 10 }));

    // useRenderTracker render — no Profiler data
    store.recordRender('Btn', makeEvent({ actualDuration: -1, baseDuration: -1 }));

    const entry = store.components.get('Btn')!;
    expect(entry.renderCount).toBe(2); // counted
    expect(entry.avgDuration).toBe(5); // not corrupted by -1
    expect(entry.maxDuration).toBe(5);
    expect(entry.lastDuration).toBe(5); // unchanged
  });

  it('works with hook-only tracking (no Profiler data at all)', () => {
    store.recordRender('HookOnly', makeEvent({ phase: 'mount', actualDuration: -1, baseDuration: -1 }));
    store.recordRender('HookOnly', makeEvent({ actualDuration: -1, baseDuration: -1 }));

    const entry = store.components.get('HookOnly')!;
    expect(entry.renderCount).toBe(2);
    expect(entry.avgDuration).toBe(0); // no real data yet
    expect(entry.maxDuration).toBe(0);
  });
});
