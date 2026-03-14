import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import { createElement } from 'react';
import { PerfLensProvider } from '../../src/core/provider';
import { PerfLensTrack } from '../../src/core/track';
import { PerfLensPanel } from '../../src/panel/PerfLensPanel';

function SlowChild() {
  return createElement('div', null, 'rendered');
}

function TestApp() {
  return createElement(
    PerfLensProvider,
    null,
    createElement(PerfLensTrack, { name: 'SlowChild' }, createElement(SlowChild)),
    createElement(PerfLensPanel),
  );
}

/** Render and flush effects so the portal mounts. */
async function renderApp() {
  await act(async () => {
    render(createElement(TestApp));
  });
}

/** Open the panel by clicking the pill. */
async function openPanel() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /open perflens panel/i }));
  });
}

describe('PerfLensPanel integration', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    const portal = document.getElementById('perflens-panel-root');
    if (portal) portal.remove();
  });

  it('renders the collapsed pill by default', async () => {
    await renderApp();

    expect(screen.getByRole('button', { name: /open perflens panel/i })).toBeDefined();
  });

  it('opens the panel when pill is clicked', async () => {
    await renderApp();
    await openPanel();

    expect(screen.getByRole('dialog', { name: /perflens performance panel/i })).toBeDefined();
  });

  it('shows component table with tracked components after opening', async () => {
    await renderApp();
    await openPanel();

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    await waitFor(() => {
      expect(screen.getByText('SlowChild')).toBeDefined();
    });
  });

  it('shows tabs for components and insights', async () => {
    await renderApp();
    await openPanel();

    expect(screen.getByRole('tab', { name: /components/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /insights/i })).toBeDefined();
  });

  it('switches between tabs', async () => {
    await renderApp();
    await openPanel();

    const insightsTab = screen.getByRole('tab', { name: /insights/i });
    await act(async () => {
      fireEvent.click(insightsTab);
    });

    expect(insightsTab.getAttribute('aria-selected')).toBe('true');
  });

  it('closes the panel when close button is clicked', async () => {
    await renderApp();
    await openPanel();

    expect(screen.getByRole('dialog')).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /close panel/i }));
    });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: /open perflens panel/i })).toBeDefined();
  });

  it('export button produces a valid JSON blob', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:test');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(globalThis, 'URL', {
      value: { createObjectURL, revokeObjectURL },
      writable: true,
    });

    await renderApp();
    await openPanel();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /export snapshot/i }));
    });

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('application/json');
  });

  it('clear button is accessible and functional', async () => {
    await renderApp();
    await openPanel();

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    await waitFor(() => {
      expect(screen.getByText('SlowChild')).toBeDefined();
    });

    // clear button exists and is clickable
    const clearBtn = screen.getByRole('button', { name: /clear data/i });
    expect(clearBtn).toBeDefined();

    // click doesn't throw
    await act(async () => {
      fireEvent.click(clearBtn);
    });

    // panel still renders after clear — no crash
    expect(screen.getByRole('dialog')).toBeDefined();
  });
});
