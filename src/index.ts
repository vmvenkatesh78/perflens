// perflens public API

// Core
export { PerfLensProvider } from './core/provider';
export { PerfLensTrack } from './core/track';
export { useRenderTracker } from './core/use-render-tracker';
export { usePerfLensStore } from './core/use-perflens-store';

// Panel lives at 'perflens/panel' — separate entry point so
// the UI code doesn't bloat the core bundle for consumers
// who only use the hooks programmatically.

// Types
export type {
  PerfLensConfig,
  PerfLensThresholds,
  ComponentPerfData,
  RenderEvent,
  Insight,
  InsightType,
  InsightSeverity,
  PerfLensStore,
  PerfLensSnapshot,
  UseRenderTrackerOptions,
} from './types';
