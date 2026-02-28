import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { createElement, useContext } from 'react';
import { PerfLensProvider, PerfLensContext } from '../../src/core/provider';

describe('PerfLensProvider', () => {
  it('renders children', () => {
    const { getByText } = render(
      createElement(PerfLensProvider, null,
        createElement('div', null, 'hello'),
      ),
    );

    expect(getByText('hello')).toBeDefined();
  });

  it('provides context when enabled', () => {
    let ctxValue: unknown = 'not set';

    function ContextSpy() {
      ctxValue = useContext(PerfLensContext);
      return null;
    }

    render(
      createElement(PerfLensProvider, null,
        createElement(ContextSpy),
      ),
    );

    expect(ctxValue).not.toBeNull();
    expect(ctxValue).toHaveProperty('store');
    expect(ctxValue).toHaveProperty('config');
  });

  it('skips context when disabled via prop', () => {
    let ctxValue: unknown = 'not set';

    function ContextSpy() {
      ctxValue = useContext(PerfLensContext);
      return null;
    }

    render(
      createElement(PerfLensProvider, { enabled: false },
        createElement(ContextSpy),
      ),
    );

    expect(ctxValue).toBeNull();
  });

  it('skips context when disabled via config', () => {
    let ctxValue: unknown = 'not set';

    function ContextSpy() {
      ctxValue = useContext(PerfLensContext);
      return null;
    }

    render(
      createElement(PerfLensProvider, { config: { enabled: false } },
        createElement(ContextSpy),
      ),
    );

    expect(ctxValue).toBeNull();
  });

  it('enabled prop overrides config.enabled', () => {
    let ctxValue: unknown = 'not set';

    function ContextSpy() {
      ctxValue = useContext(PerfLensContext);
      return null;
    }

    render(
      createElement(PerfLensProvider, {
        enabled: false,
        config: { enabled: true },
      },
        createElement(ContextSpy),
      ),
    );

    // prop wins — disabled
    expect(ctxValue).toBeNull();
  });

  it('applies custom thresholds from config', () => {
    let config: { thresholds?: { slowRenderMs?: number } } | null = null;

    function ConfigSpy() {
      const ctx = useContext(PerfLensContext);
      if (ctx) config = ctx.config;
      return null;
    }

    render(
      createElement(PerfLensProvider, {
        config: { thresholds: { slowRenderMs: 32 } },
      },
        createElement(ConfigSpy),
      ),
    );

    expect(config).not.toBeNull();
    expect(config!.thresholds!.slowRenderMs).toBe(32);
  });
});
