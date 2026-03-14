import type { ComponentPerfData, Insight, PerfLensThresholds } from '../types';
import { bySeverity } from './utils';
import * as slowRender from './rules/slow-render';
import * as excessiveRerenders from './rules/excessive-rerenders';
import * as rapidMountUnmount from './rules/rapid-mount-unmount';
import * as wastedMemo from './rules/wasted-memo';
import * as unnecessaryRerender from './rules/unnecessary-rerender';

// all active rules — add new ones here as they ship
const rules = [slowRender, excessiveRerenders, rapidMountUnmount, wastedMemo, unnecessaryRerender];

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

  for (const [name, data] of components) {
    for (const rule of rules) {
      try {
        const hits = rule.check(name, data, thresholds);
        for (const insight of hits) {
          // latest insight for a given id wins — data might have changed
          // since the last sweep
          seen.set(insight.id, insight);
        }
      } catch (_err) {
        // one bad rule shouldn't take down the whole analyzer
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[perflens] analyzer rule failed for <${name}>:`, _err);
        }
      }
    }
  }

  return Array.from(seen.values()).sort(bySeverity);
}
