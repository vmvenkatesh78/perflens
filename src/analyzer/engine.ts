import type { ComponentPerfData, Insight, PerfLensThresholds } from '../types';

/** Runs all insight rules against current store data. Called on a timer, not per render. */
export function runAnalyzer(
  _components: Map<string, ComponentPerfData>,
  _thresholds: PerfLensThresholds,
): Insight[] {
  // TODO(v0.3.0): wire up rules
  return [];
}
