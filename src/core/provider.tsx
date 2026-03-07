import { createContext, useContext, useMemo, useRef, useEffect, Profiler } from 'react';
import type { ReactNode } from 'react';
import type { PerfLensConfig, PerfLensThresholds, PanelPosition, Insight } from '../types';
import { PerfStore } from './store';
import { DEFAULT_CONFIG, DEFAULT_THRESHOLDS } from '../constants';
import { createProfilerCallback } from './profiler-callback';
import { runAnalyzer } from '../analyzer/engine';

// Context

interface PerfLensContextValue {
  store: PerfStore;
  config: ResolvedConfig;
}

/** Config with all optionals resolved to concrete values. */
export interface ResolvedConfig {
  enabled: boolean;
  panelPosition: PanelPosition;
  toggleKey: string;
  thresholds: PerfLensThresholds;
  maxTrackedComponents: number;
  maxRenderEvents: number;
  analyzerInterval: number;
  onInsight?: (insight: Insight) => void;
}

export const PerfLensContext = createContext<PerfLensContextValue | null>(null);

// Provider

interface PerfLensProviderProps {
  children: ReactNode;
  config?: PerfLensConfig;
  /** Shorthand for config.enabled. When false, renders children with zero overhead. */
  enabled?: boolean;
}

/**
 * Wraps your app with a Profiler and perf store.
 * When disabled, renders children directly — no Profiler, no context, no store.
 */
export function PerfLensProvider({ children, config, enabled }: PerfLensProviderProps) {
  const isEnabled = enabled ?? config?.enabled ?? DEFAULT_CONFIG.enabled;

  if (!isEnabled) {
    return <>{children}</>;
  }

  // spread config only if defined — exactOptionalPropertyTypes
  // prevents passing undefined to an optional prop
  const innerProps = config ? { config } : {};

  return <PerfLensProviderInner {...innerProps}>{children}</PerfLensProviderInner>;
}

function PerfLensProviderInner({
  children,
  config,
}: {
  children: ReactNode;
  config?: PerfLensConfig;
}) {
  const resolvedConfig = useMemo(() => resolveConfig(config), [config]);

  // store lives in a ref — mutations happen on every render callback,
  // and we definitely don't want React re-rendering because of that
  const storeRef = useRef<PerfStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = new PerfStore(
      resolvedConfig.maxTrackedComponents,
      resolvedConfig.maxRenderEvents,
    );
  }

  // narrowing — storeRef.current is guaranteed non-null after the block above
  const store = storeRef.current;

  const onRender = useMemo(() => createProfilerCallback(store), [store]);

  const contextValue = useMemo<PerfLensContextValue>(
    () => ({
      store,
      config: resolvedConfig,
    }),
    [store, resolvedConfig],
  );

  // run the analyzer on a timer — sweeps all tracked components for issues.
  // writes directly to store.insights (mutable), no React state involved.
  useEffect(() => {
    const id = setInterval(() => {
      if (store.components.size === 0) return;

      const newInsights = runAnalyzer(store.components, resolvedConfig.thresholds);

      // figure out which insights are genuinely new (not seen before)
      const previousIds = new Set(store.insights.map((i) => i.id));
      const fresh = newInsights.filter((i) => !previousIds.has(i.id));

      store.insights = newInsights;

      // fire the callback for each new insight — useful for piping to analytics
      if (resolvedConfig.onInsight && fresh.length > 0) {
        for (const insight of fresh) {
          try {
            resolvedConfig.onInsight(insight);
          } catch (err) {
            if (process.env.NODE_ENV !== 'production') {
              console.warn('[perflens] onInsight callback error:', err);
            }
          }
        }
      }
    }, resolvedConfig.analyzerInterval);

    return () => clearInterval(id);
  }, [resolvedConfig, store]);

  return (
    <PerfLensContext.Provider value={contextValue}>
      <Profiler id="perflens-root" onRender={onRender}>
        {children}
      </Profiler>
    </PerfLensContext.Provider>
  );
}

// Internal — other hooks grab context through this

/** @throws if called outside PerfLensProvider */ export function usePerfLensContext(): PerfLensContextValue {
  const ctx = useContext(PerfLensContext);
  if (!ctx) {
    throw new Error('[perflens] Hook called outside <PerfLensProvider>. Wrap your app first.');
  }
  return ctx;
}

// Config resolution

function resolveConfig(config?: PerfLensConfig): ResolvedConfig {
  const base = {
    enabled: config?.enabled ?? DEFAULT_CONFIG.enabled,
    panelPosition: config?.panelPosition ?? DEFAULT_CONFIG.panelPosition,
    toggleKey: config?.toggleKey ?? DEFAULT_CONFIG.toggleKey,
    maxTrackedComponents: config?.maxTrackedComponents ?? DEFAULT_CONFIG.maxTrackedComponents,
    maxRenderEvents: config?.maxRenderEvents ?? DEFAULT_CONFIG.maxRenderEvents,
    analyzerInterval: config?.analyzerInterval ?? DEFAULT_CONFIG.analyzerInterval,
    thresholds: {
      ...DEFAULT_THRESHOLDS,
      ...config?.thresholds,
    },
  };

  // only set onInsight if provided — exactOptionalPropertyTypes
  // prevents assigning undefined to optional properties
  if (config?.onInsight) {
    return { ...base, onInsight: config.onInsight };
  }

  return base;
}
