import type { PerfLensThresholds, PerfLensConfig } from './types';

export const DEFAULT_THRESHOLDS: PerfLensThresholds = {
  excessiveRenderCount: 20,
  excessiveRenderWindow: 10_000,
  slowRenderMs: 16,
  memoSavingsThreshold: 10,
  rapidMountCycles: 5,
  rapidMountWindow: 5_000,
  cascadeChildThreshold: 5,
};

export const DEFAULT_CONFIG = {
  enabled: true,
  panelPosition: 'bottom-right',
  toggleKey: 'ctrl+shift+p',
  maxTrackedComponents: 200,
  maxRenderEvents: 100,
  analyzerInterval: 2_000,
} as const satisfies Required<Omit<PerfLensConfig, 'thresholds' | 'onInsight'>>;

export const PANEL_POLL_INTERVAL = 500;

export const VERSION = '0.2.0';
