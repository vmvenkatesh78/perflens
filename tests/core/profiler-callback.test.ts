import { describe, it, expect, vi } from 'vitest';
import { createProfilerCallback } from '../../src/core/profiler-callback';
import { PerfStore } from '../../src/core/store';

describe('createProfilerCallback', () => {
  it('records render data into the store', () => {
    const store = new PerfStore(200, 100);
    const callback = createProfilerCallback(store);

    callback('TestComponent', 'mount', 4.5, 10.2, 0, 1);

    expect(store.components.has('TestComponent')).toBe(true);

    const entry = store.components.get('TestComponent')!;
    expect(entry.renderCount).toBe(1);
    expect(entry.lastDuration).toBe(4.5);
    expect(entry.lastBaseDuration).toBe(10.2);
  });

  it('handles update phase', () => {
    const store = new PerfStore(200, 100);
    const callback = createProfilerCallback(store);

    callback('Comp', 'mount', 5, 10, 0, 1);
    callback('Comp', 'update', 2, 10, 5, 6);

    const entry = store.components.get('Comp')!;
    expect(entry.mountCount).toBe(1);
    expect(entry.updateCount).toBe(1);
    expect(entry.renderCount).toBe(2);
  });

  it('swallows errors', () => {
    const store = new PerfStore(200, 100);
    vi.spyOn(store, 'recordRender').mockImplementation(() => {
      throw new Error('boom');
    });

    const callback = createProfilerCallback(store);
    expect(() => callback('Broken', 'mount', 1, 1, 0, 1)).not.toThrow();
  });
});
