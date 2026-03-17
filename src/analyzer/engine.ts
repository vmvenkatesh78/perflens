import type { ComponentPerfData, Insight, PerfLensThresholds } from '../types';
import { bySeverity } from './utils';
import * as slowRender from './rules/slow-render';
import * as excessiveRerenders from './rules/excessive-rerenders';
import * as rapidMountUnmount from './rules/rapid-mount-unmount';
import * as wastedMemo from './rules/wasted-memo';
import * as unnecessaryRerender from './rules/unnecessary-rerender';
import * as renderCascade from './rules/render-cascade';

/** Per-component rule — called once per tracked component. */
interface ComponentRule {
  check(name: string, data: ComponentPerfData, thresholds: PerfLensThresholds, now?: number): Insight[];
}

/** Cross-component rule — receives the full map, analyzes relationships. */
interface GlobalRule {
  checkAll(components: Map<string, ComponentPerfData>, thresholds: PerfLensThresholds, now?: number): Insight[];
}

// per-component rules — each fires independently per component
const componentRules: ComponentRule[] = [
  slowRender,
  excessiveRerenders,
  rapidMountUnmount,
  wastedMemo,
  unnecessaryRerender,
];

// cross-component rules — need the full map to detect relationships
const globalRules: GlobalRule[] = [renderCascade];

/**
 * Sweeps every tracked component through every active rule.
 * Called on a timer from the provider, not on every render.
 *
 * Returns a deduplicated, severity-sorted list of insights.
 * Dedup key is insight.id (type::componentName), so a component
 * only gets one insight per rule — the latest one wins.
 */
export function runAnalyzer(
  components: Map<string, ComponentPerfData>,
  thresholds: PerfLensThresholds,
): Insight[] {
  const seen = new Map<string, Insight>();

  // per-component rules
  for (const [name, data] of components) {
    for (const rule of componentRules) {
      try {
        const hits = rule.check(name, data, thresholds);
        for (const insight of hits) {
          seen.set(insight.id, insight);
        }
      } catch (_err) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[perflens] analyzer rule failed for <${name}>:`, _err);
        }
      }
    }
  }

  // cross-component rules
  for (const rule of globalRules) {
    try {
      const hits = rule.checkAll(components, thresholds);
      for (const insight of hits) {
        seen.set(insight.id, insight);
      }
    } catch (_err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[perflens] global analyzer rule failed:', _err);
      }
    }
  }

  return Array.from(seen.values()).sort(bySeverity);
}
