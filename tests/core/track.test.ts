import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import { createElement, useState } from 'react';
import { PerfLensProvider } from '../../src/core/provider';
import { PerfLensTrack } from '../../src/core/track';
import { usePerfLensStore } from '../../src/core/use-perflens-store';

function TestApp({ children }: { children: React.ReactNode }) {
  return createElement(PerfLensProvider, null, children);
}

describe('PerfLensTrack', () => {
  it('records render with actual timing data', () => {
    let store: ReturnType<typeof usePerfLensStore>;

    function StoreReader() {
      store = usePerfLensStore();
      return null;
    }

    render(
      createElement(TestApp, null,
        createElement(PerfLensTrack, { name: 'Tracked' },
          createElement('div', null, 'child'),
        ),
        createElement(StoreReader),
      ),
    );

    const entry = store!.components.get('Tracked');
    expect(entry).toBeDefined();
    expect(entry!.renderCount).toBeGreaterThan(0);
    // PerfLensTrack wraps with Profiler, so duration should be >= 0 (not -1)
    expect(entry!.lastDuration).toBeGreaterThanOrEqual(0);
  });

  it('tracks mount phase on first render', () => {
    let store: ReturnType<typeof usePerfLensStore>;

    function StoreReader() {
      store = usePerfLensStore();
      return null;
    }

    render(
      createElement(TestApp, null,
        createElement(PerfLensTrack, { name: 'MountTest' },
          createElement('div'),
        ),
        createElement(StoreReader),
      ),
    );

    const entry = store!.components.get('MountTest');
    expect(entry).toBeDefined();
    expect(entry!.mountCount).toBeGreaterThanOrEqual(1);
  });

  it('records unmount on cleanup', () => {
    let store: ReturnType<typeof usePerfLensStore>;

    function StoreReader() {
      store = usePerfLensStore();
      return null;
    }

    function Toggle() {
      const [show, setShow] = useState(true);
      return createElement(
        'div',
        null,
        show
          ? createElement(PerfLensTrack, { name: 'Removable' },
              createElement('div', null, 'here'),
            )
          : null,
        createElement('button', {
          'data-testid': 'toggle',
          onClick: () => setShow(false),
        }, 'hide'),
        createElement(StoreReader),
      );
    }

    const { getByTestId } = render(createElement(TestApp, null, createElement(Toggle)));

    expect(store!.components.get('Removable')).toBeDefined();

    act(() => {
      getByTestId('toggle').click();
    });

    const entry = store!.components.get('Removable');
    expect(entry!.isMounted).toBe(false);
    expect(entry!.mountUnmountCycles).toBe(1);
  });

  it('uses the name prop as the component key', () => {
    let store: ReturnType<typeof usePerfLensStore>;

    function StoreReader() {
      store = usePerfLensStore();
      return null;
    }

    render(
      createElement(TestApp, null,
        createElement(PerfLensTrack, { name: 'CustomName' },
          createElement('span'),
        ),
        createElement(StoreReader),
      ),
    );

    expect(store!.components.has('CustomName')).toBe(true);
    expect(store!.components.has('PerfLensTrack')).toBe(false);
  });
});
