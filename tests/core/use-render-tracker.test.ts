import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { useRenderTracker, shallowEqual } from '../../src/core/use-render-tracker';
import { usePerfLensStore } from '../../src/core/use-perflens-store';
import { PerfLensProvider } from '../../src/core/provider';

function wrapper({ children }: { children: ReactNode }) {
  return createElement(PerfLensProvider, null, children);
}

describe('useRenderTracker', () => {
  it('records a render into the store', () => {
    const { result } = renderHook(
      () => {
        useRenderTracker('TestComp');
        return usePerfLensStore();
      },
      { wrapper },
    );

    const entry = result.current.components.get('TestComp');
    expect(entry).toBeDefined();
    expect(entry!.renderCount).toBeGreaterThan(0);
  });

  it('skips duration tracking (no Profiler data at hook level)', () => {
    const { result } = renderHook(
      () => {
        useRenderTracker('NoDuration');
        return usePerfLensStore();
      },
      { wrapper },
    );

    const entry = result.current.components.get('NoDuration');
    expect(entry).toBeDefined();
    expect(entry!.lastDuration).toBe(0); // hook-level renders skip duration tracking
  });

  it('does nothing when ignore is true', () => {
    const { result } = renderHook(
      () => {
        useRenderTracker('Ignored', { ignore: true });
        return usePerfLensStore();
      },
      { wrapper },
    );

    expect(result.current.components.has('Ignored')).toBe(false);
  });

  it('records unmount on cleanup', () => {
    const { result, unmount } = renderHook(
      () => {
        useRenderTracker('WillUnmount');
        return usePerfLensStore();
      },
      { wrapper },
    );

    unmount();

    const entry = result.current.components.get('WillUnmount');
    expect(entry).toBeDefined();
    expect(entry!.isMounted).toBe(false);
    expect(entry!.mountUnmountCycles).toBe(1);
  });

  it('throws when used outside provider', () => {
    expect(() => {
      renderHook(() => useRenderTracker('Orphan'));
    }).toThrow('[perflens]');
  });
});

describe('shallowEqual', () => {
  it('returns true for identical objects', () => {
    const obj = { a: 1, b: 'two' };
    expect(shallowEqual(obj, obj)).toBe(true);
  });

  it('returns true for same key-value pairs', () => {
    expect(shallowEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
  });

  it('returns false for different values', () => {
    expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it('returns false for different key counts', () => {
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it('returns false for different keys', () => {
    expect(shallowEqual({ a: 1 }, { b: 1 })).toBe(false);
  });

  it('compares by reference for objects', () => {
    const arr = [1, 2, 3];
    expect(shallowEqual({ data: arr }, { data: arr })).toBe(true);
    expect(shallowEqual({ data: [1, 2, 3] }, { data: [1, 2, 3] })).toBe(false);
  });

  it('handles empty objects', () => {
    expect(shallowEqual({}, {})).toBe(true);
  });
});
