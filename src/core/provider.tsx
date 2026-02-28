import { createContext, useContext, useMemo, useRef, Profiler } from 'react';
import type { ReactNode } from 'react';
import type { PerfLensConfig, PerfLensThresholds, Insight } from '../types';
import { PerfStore } from './store';
import { DEFAULT_CONFIG, DEFAULT_THRESHOLDS } from '../constants';
import { createProfilerCallback } from './profiler-callback';

interface PerfLensContextValue {
  store: PerfStore;
  config: ResolvedConfig;
}

/** Config with all optionals resolved to concrete values. */
export interface ResolvedConfig {
  enabled: boolean;
  panelPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  toggleKey: string;
  thresholds: PerfLensThresholds;
  maxTrackedComponents: number;
  maxRenderEvents: number;
  analyzerInterval: number;
  onInsight?: (insight: Insight) => void;
}

export const PerfLensContext = createContext<PerfLensContextValue | null>(null);

interface PerfLensProviderProps {
  children: ReactNode;
  config?: PerfLensConfig;
  /** Shorthand for config.enabled. When false, renders children with zero overhead. */
  enabled?: boolean;
}

/**
 * Sets up the Profiler and perf store for the wrapped subtree.
 * When disabled, renders children directly — no Profiler, no context, no store.
 *
 * @param props.enabled - Kill switch. Shorthand for `config.enabled`.
 * @param props.config - Full config. Merged with defaults.
 */
export function PerfLensProvider({ children, config, enabled }: PerfLensProviderProps) {
  const isEnabled = enabled ?? config?.enabled ?? DEFAULT_CONFIG.enabled;

  if (!isEnabled) {
    return <>{children}</>;
  }

  return <PerfLensProviderInner config={config}>{children}</PerfLensProviderInner>;
}

function PerfLensProviderInner({
  children,
  config,
}: {
  children: ReactNode;
  config?: PerfLensConfig;
}) {
  const resolvedConfig = useMemo(() => resolveConfig(config), [config]);

  // store lives in a ref, not state — we don't want React re-renders on every mutation
  const storeRef = useRef<PerfStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = new PerfStore(
      resolvedConfig.maxTrackedComponents,
      resolvedConfig.maxRenderEvents,
    );
  }

  const onRender = useMemo(
    () => createProfilerCallback(storeRef.current!),
    [],
  );

  const contextValue = useMemo<PerfLensContextValue>(
    () => ({
      store: storeRef.current!,
      config: resolvedConfig,
    }),
    [resolvedConfig],
  );

  return (
    <PerfLensContext.Provider value={contextValue}>
      <Profiler id="perflens-root" onRender={onRender}>
        {children}
      </Profiler>
    </PerfLensContext.Provider>
  );
}

/** Grabs the perflens context. Throws if called outside the provider. */
export function usePerfLensContext(): PerfLensContextValue {
  const ctx = useContext(PerfLensContext);
  if (!ctx) {
    throw new Error(
      '[perflens] Hook called outside <PerfLensProvider>. Wrap your app first.',
    );
  }
  return ctx;
}

function resolveConfig(config?: PerfLensConfig): ResolvedConfig {
  return {
    enabled: config?.enabled ?? DEFAULT_CONFIG.enabled,
    panelPosition: config?.panelPosition ?? DEFAULT_CONFIG.panelPosition,
    toggleKey: config?.toggleKey ?? DEFAULT_CONFIG.toggleKey,
    maxTrackedComponents: config?.maxTrackedComponents ?? DEFAULT_CONFIG.maxTrackedComponents,
    maxRenderEvents: config?.maxRenderEvents ?? DEFAULT_CONFIG.maxRenderEvents,
    analyzerInterval: config?.analyzerInterval ?? DEFAULT_CONFIG.analyzerInterval,
    onInsight: config?.onInsight,
    thresholds: {
      ...DEFAULT_THRESHOLDS,
      ...config?.thresholds,
    },
  };
}
