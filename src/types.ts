export type RenderPhase = 'mount' | 'update';

/**
 * Bounded buffer backing each component's render history.
 * Consumers use toArray() for snapshots — never treat as a plain array.
 */
export interface RenderBuffer {
  readonly count: number;
  push(item: RenderEvent): void;
  toArray(): RenderEvent[];
  itemsSince(since: number, getTime: (item: RenderEvent) => number): RenderEvent[];
  clear(): void;
}

/**
 * Single render event captured by React's Profiler.
 * Durations are in ms, timestamps from performance.now().
 */
export interface RenderEvent {
  timestamp: number;
  phase: RenderPhase;
  /** ms spent rendering this subtree. Straight from Profiler. */
  actualDuration: number;
  /** Estimated cost without memoization (ms). Useful for wasted-memo detection. */
  baseDuration: number;
  startTime: number;
  commitTime: number;
  /** Reserved for prop change detection (v0.3.0). Always null until implemented. */
  propsChanged: boolean | null;
}

/**
 * Accumulated perf data for a single tracked component.
 * Updated on every render — read by the panel on a polling interval.
 */
export interface ComponentPerfData {
  name: string;
  renderCount: number;
  mountCount: number;
  updateCount: number;
  lastDuration: number;
  /** Running average across all profiled renders. */
  avgDuration: number;
  maxDuration: number;
  totalDuration: number;
  lastBaseDuration: number;
  firstRenderAt: number;
  lastRenderAt: number;
  /** Bounded ring buffer — oldest entries get overwritten. See CircularBuffer. */
  recentRenders: RenderBuffer;
  /** Shallow copy of previous props, for change detection between renders. */
  prevProps: Record<string, unknown> | null;
  isMounted: boolean;
  /** Tracks destroy-and-recreate patterns (key prop abuse, conditional rendering). */
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

/**
 * A performance issue detected by the analyzer.
 * Each insight maps to exactly one component and one rule.
 */
export interface Insight {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  componentName: string;
  /** What happened, e.g. "UserList rendered 47 times in 10s" */
  title: string;
  /** Why it matters. */
  description: string;
  /** Actionable fix. */
  suggestion: string;
  data: InsightData;
  createdAt: number;
  dismissed: boolean;
}

/** Switch on `type` to narrow the payload — standard discriminated union pattern. */
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
  /** Cap on tracked components before LRU eviction kicks in. */
  maxTrackedComponents?: number;
  /** Ring buffer size per component. Older render events get overwritten. */
  maxRenderEvents?: number;
  /** How often the analyzer sweeps for issues (ms). */
  analyzerInterval?: number;
  /** Fires every time a new insight is created. Hook this up to your analytics. */
  onInsight?: (insight: Insight) => void;
}

export interface PerfLensThresholds {
  /** Renders in window before flagging. Default: 20 */
  excessiveRenderCount: number;
  /** Time window for counting (ms). Default: 10000 */
  excessiveRenderWindow: number;
  /** One frame at 60fps = 16ms. Anything over this is slow. */
  slowRenderMs: number;
  /** Below this %, memo overhead isn't worth it. Default: 10 */
  memoSavingsThreshold: number;
  rapidMountCycles: number;
  rapidMountWindow: number;
  cascadeChildThreshold: number;
  /** % of update renders that must be unnecessary before flagging. Default: 50 */
  unnecessaryRerenderRatio: number;
  /** Minimum update renders in window before the rule activates. Default: 5 */
  unnecessaryRerenderMinCount: number;
}

export interface UseRenderTrackerOptions {
  /**
   * Pass the component's props to enable unnecessary re-render detection.
   * perflens shallow-compares them between renders to determine if the
   * re-render could have been avoided with React.memo.
   *
   * @example
   * function UserList({ users, onSelect }: Props) {
   *   useRenderTracker('UserList', { props: { users, onSelect } });
   *   return ...;
   * }
   */
  props?: Record<string, unknown>;
  /** Override the excessive render threshold for this specific component. */
  warnAfterRenders?: number;
  /** Override slow render threshold (ms) for this specific component. */
  slowThreshold?: number;
  /** Skip tracking entirely. Useful for components you expect to be noisy. */
  ignore?: boolean;
}

// Store

/** Public store interface exposed via usePerfLensStore(). */
export interface PerfLensStore {
  components: Map<string, ComponentPerfData>;
  insights: Insight[];
  isEnabled: boolean;
  startedAt: number;
  totalRenders: number;
  clear: () => void;
  /** Returns a JSON-safe copy of everything. Safe to postMessage or stringify. */
  snapshot: () => PerfLensSnapshot;
}

/** Flat, serializable version of the store. Map → array so JSON.stringify works. */
export interface PerfLensSnapshot {
  components: SerializedComponentPerfData[];
  insights: Insight[];
  metadata: {
    capturedAt: number;
    trackingDuration: number;
    totalRenders: number;
    perflensVersion: string;
  };
}

/** JSON-safe version of ComponentPerfData with buffer flattened to array. */
export interface SerializedComponentPerfData extends Omit<ComponentPerfData, 'recentRenders'> {
  recentRenders: RenderEvent[];
}
