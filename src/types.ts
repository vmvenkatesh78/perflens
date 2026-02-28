export type RenderPhase = 'mount' | 'update';

export interface RenderEvent {
  /** High-res timestamp from performance.now(). */
  timestamp: number;
  phase: RenderPhase;
  /** Time React spent rendering this subtree (ms). From Profiler. */
  actualDuration: number;
  /** Estimated time to render without memoization (ms). From Profiler. */
  baseDuration: number;
  /** When React began this render pass. */
  startTime: number;
  /** When React committed changes to the DOM. */
  commitTime: number;
  /** Whether props changed since last render. null when trackProps is off. */
  propsChanged: boolean | null;
}

export interface ComponentPerfData {
  name: string;
  renderCount: number;
  mountCount: number;
  updateCount: number;
  /** Most recent actualDuration. 0 if only tracked via useRenderTracker. */
  lastDuration: number;
  /** Running average of actualDuration across profiled renders. */
  avgDuration: number;
  maxDuration: number;
  totalDuration: number;
  lastBaseDuration: number;
  /** Renders with Profiler timing data. Excludes hook-only (useRenderTracker) renders. */
  profiledRenderCount: number;
  firstRenderAt: number;
  lastRenderAt: number;
  /** Ring buffer of recent render events. Bounded by maxRenderEvents. */
  recentRenders: RenderEvent[];
  /** Shallow copy of previous props for change detection. */
  prevProps: Record<string, unknown> | null;
  isMounted: boolean;
  /** How many times this component has been mounted then unmounted. */
  mountUnmountCycles: number;
}

// Insights

export type InsightSeverity = 'info' | 'warning' | 'critical';

export type InsightType =
  | 'excessive-rerenders'
  | 'slow-render'
  | 'unnecessary-rerender'
  | 'render-cascade'
  | 'wasted-memo'
  | 'rapid-mount-unmount';

export interface Insight {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  componentName: string;
  /** What happened. */
  title: string;
  /** Why it matters. */
  description: string;
  /** What to do about it. */
  suggestion: string;
  data: InsightData;
  createdAt: number;
  dismissed: boolean;
}

/** Discriminated union. Switch on `type` to narrow the payload. */
export type InsightData =
  | {
      type: 'excessive-rerenders';
      renderCount: number;
      timeWindowMs: number;
      rendersPerSecond: number;
    }
  | {
      type: 'slow-render';
      avgDuration: number;
      maxDuration: number;
      frameBudgetMs: number;
    }
  | {
      type: 'unnecessary-rerender';
      totalUnnecessary: number;
      totalRenders: number;
      wastedMs: number;
    }
  | {
      type: 'render-cascade';
      parentName: string;
      childrenAffected: number;
      totalCascadeDuration: number;
    }
  | {
      type: 'wasted-memo';
      actualDuration: number;
      baseDuration: number;
      savingsPercent: number;
    }
  | {
      type: 'rapid-mount-unmount';
      cycles: number;
      timeWindowMs: number;
      cyclesPerSecond: number;
    };

// Configuration

export type PanelPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface PerfLensConfig {
  enabled?: boolean;
  panelPosition?: PanelPosition;
  /** Keyboard shortcut to toggle the panel. Default: 'ctrl+shift+p' */
  toggleKey?: string;
  thresholds?: Partial<PerfLensThresholds>;
  /** Max components before LRU eviction kicks in. Default: 200 */
  maxTrackedComponents?: number;
  /** Ring buffer size per component. Default: 100 */
  maxRenderEvents?: number;
  /** How often the analyzer runs (ms). Default: 2000 */
  analyzerInterval?: number;
  /** Fires each time a new insight is generated. */
  onInsight?: (insight: Insight) => void;
}

export interface PerfLensThresholds {
  /** Renders in window before flagging. Default: 20 */
  excessiveRenderCount: number;
  /** Time window for excessive render counting (ms). Default: 10000 */
  excessiveRenderWindow: number;
  /** Render duration that counts as slow (ms). Default: 16 (one frame @ 60fps) */
  slowRenderMs: number;
  /** Minimum memo savings % to be considered worth keeping. Default: 10 */
  memoSavingsThreshold: number;
  /** Mount/unmount cycles before flagging. Default: 5 */
  rapidMountCycles: number;
  /** Time window for rapid mount detection (ms). Default: 5000 */
  rapidMountWindow: number;
  /** Min children in a commit to flag a cascade. Default: 5 */
  cascadeChildThreshold: number;
}

export interface UseRenderTrackerOptions {
  /** Shallow-compare props between renders. Default: false */
  trackProps?: boolean;
  /** Override the excessive render threshold for this component. */
  warnAfterRenders?: number;
  /** Override the slow render threshold (ms) for this component. */
  slowThreshold?: number;
  /** Skip tracking entirely. Handy for components you expect to render often. */
  ignore?: boolean;
}

// Store

export interface PerfLensStore {
  components: Map<string, ComponentPerfData>;
  insights: Insight[];
  isEnabled: boolean;
  startedAt: number;
  totalRenders: number;
  clear: () => void;
  /** Serializable snapshot of the store. Safe to JSON.stringify or postMessage. */
  snapshot: () => PerfLensSnapshot;
}

/** Serializable store snapshot. Map flattened to array for JSON/postMessage. */
export interface PerfLensSnapshot {
  components: ComponentPerfData[];
  insights: Insight[];
  metadata: {
    capturedAt: number;
    trackingDuration: number;
    totalRenders: number;
    perflensVersion: string;
  };
}
