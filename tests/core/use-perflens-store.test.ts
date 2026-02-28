import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { usePerfLensStore } from '../../src/core/use-perflens-store';
import { PerfLensProvider } from '../../src/core/provider';

function wrapper({ children }: { children: ReactNode }) {
  return createElement(PerfLensProvider, null, children);
}

describe('usePerfLensStore', () => {
  it('returns the store interface', () => {
    const { result } = renderHook(() => usePerfLensStore(), { wrapper });

    expect(result.current.components).toBeInstanceOf(Map);
    expect(result.current.insights).toEqual([]);
    expect(result.current.isEnabled).toBe(true);
    expect(typeof result.current.startedAt).toBe('number');
    expect(typeof result.current.totalRenders).toBe('number');
  });

  it('clear() resets the store', () => {
    const { result } = renderHook(() => usePerfLensStore(), { wrapper });

    result.current.clear();

    expect(result.current.components.size).toBe(0);
    expect(result.current.totalRenders).toBe(0);
  });

  it('snapshot() returns serializable data', () => {
    const { result } = renderHook(() => usePerfLensStore(), { wrapper });

    const snap = result.current.snapshot();

    expect(Array.isArray(snap.components)).toBe(true);
    expect(Array.isArray(snap.insights)).toBe(true);
    expect(snap.metadata).toHaveProperty('capturedAt');
    expect(snap.metadata).toHaveProperty('perflensVersion');
    expect(() => JSON.stringify(snap)).not.toThrow();
  });

  it('throws outside provider', () => {
    expect(() => {
      renderHook(() => usePerfLensStore());
    }).toThrow('[perflens]');
  });
});
