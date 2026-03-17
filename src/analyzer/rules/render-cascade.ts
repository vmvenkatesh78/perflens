import type { ComponentPerfData, Insight, PerfLensThresholds, RenderEvent } from '../../types';
import { insightId } from '../utils';

/**
 * Detects render cascades — when a single state change causes many
 * components to re-render in the same React commit.
 *
 * How it works: React's Profiler reports a `commitTime` for each render.
 * Components that render in the same commit share the same `commitTime`.
 * This rule groups recent render events by `commitTime`, finds commits
 * where the number of distinct components exceeds the threshold, and
 * identifies the component with the longest `actualDuration` as the
 * likely cascade root.
 *
 * This is a cross-component rule — it receives the full components map,
 * not a single component. It exports `checkAll` instead of `check`.
 */
export function checkAll(
  components: Map<string, ComponentPerfData>,
  thresholds: PerfLensThresholds,
  now?: number,
): Insight[] {
  const currentTime = now ?? performance.now();
  const windowStart = currentTime - thresholds.excessiveRenderWindow;

  // collect all recent update events across all components, tagged with name
  const taggedEvents: Array<{ name: string; event: RenderEvent }> = [];

  for (const [name, data] of components) {
    const recent = data.recentRenders.itemsSince(windowStart, (e) => e.timestamp);
    for (const event of recent) {
      // skip mounts — a mount isn't a cascade, it's initialization
      if (event.phase === 'mount') continue;
      // skip events with commitTime 0 — hook-only tracking has no commit data
      if (event.commitTime === 0) continue;
      taggedEvents.push({ name, event });
    }
  }

  if (taggedEvents.length === 0) return [];

  // group by commitTime — same commit = same cascade
  // round to nearest 0.1ms to handle minor floating-point differences
  const commits = new Map<number, Array<{ name: string; event: RenderEvent }>>();

  for (const tagged of taggedEvents) {
    const key = Math.round(tagged.event.commitTime * 10) / 10;
    let group = commits.get(key);
    if (!group) {
      group = [];
      commits.set(key, group);
    }
    group.push(tagged);
  }

  const insights: Insight[] = [];
  const seenRoots = new Set<string>();

  for (const [, group] of commits) {
    // deduplicate components within a commit — a component might appear
    // multiple times if it rendered more than once in the same commit
    const uniqueComponents = new Map<string, number>();
    for (const { name, event } of group) {
      const existing = uniqueComponents.get(name);
      if (existing === undefined || event.actualDuration > existing) {
        uniqueComponents.set(name, event.actualDuration);
      }
    }

    if (uniqueComponents.size < thresholds.cascadeChildThreshold) continue;

    // find the heaviest component — likely the cascade root
    let rootName = '';
    let maxDuration = 0;
    let totalDuration = 0;

    for (const [name, duration] of uniqueComponents) {
      totalDuration += duration;
      if (duration > maxDuration) {
        maxDuration = duration;
        rootName = name;
      }
    }

    // only emit one insight per root — if the same component is the root
    // of multiple cascades in the window, the engine's seen map would dedup
    // anyway, but skipping here avoids silently overwriting data
    if (seenRoots.has(rootName)) continue;
    seenRoots.add(rootName);

    const childrenAffected = uniqueComponents.size - 1; // exclude the root itself
    const totalRounded = Math.round(totalDuration * 100) / 100;

    // critical if 2x threshold or cascade total > 2 frame budgets (32ms)
    const severity =
      uniqueComponents.size >= thresholds.cascadeChildThreshold * 2 || totalDuration > 32
        ? 'critical'
        : 'warning';

    insights.push({
      id: insightId('render-cascade', rootName),
      type: 'render-cascade',
      severity,
      componentName: rootName,
      title: `<${rootName}> triggered a cascade affecting ${childrenAffected} components`,
      description:
        severity === 'critical'
          ? `A single commit re-rendered ${uniqueComponents.size} components, taking ` +
            `${totalRounded}ms total. This is a significant cascade — one state ` +
            `change is causing a large subtree to re-render.`
          : `${uniqueComponents.size} components re-rendered in the same commit. ` +
            `<${rootName}> had the longest render (${Math.round(maxDuration * 100) / 100}ms), ` +
            `suggesting it's the cascade root.`,
      suggestion:
        totalDuration > 32
          ? `This cascade blew the frame budget. Check if <${rootName}> is a context ` +
            `provider — context updates re-render every consumer. Split the context ` +
            `into smaller pieces, or memoize the value object. If it's a setState, ` +
            `move the state closer to where it's used.`
          : `Check what state change in or above <${rootName}> triggers this cascade. ` +
            `If all ${uniqueComponents.size} components consume the same context, splitting that ` +
            `context into smaller pieces can prevent unrelated consumers from re-rendering. ` +
            `React.memo on child components can also help if their props haven't changed.`,
      data: {
        type: 'render-cascade',
        parentName: rootName,
        childrenAffected,
        totalCascadeDuration: totalRounded,
      },
      createdAt: currentTime,
      dismissed: false,
    });
  }

  return insights;
}
