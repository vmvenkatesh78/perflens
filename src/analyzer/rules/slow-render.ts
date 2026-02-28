import type { ComponentPerfData, Insight, PerfLensThresholds } from '../../types';
import { insightId } from '../utils';

/**
 * Flags components whose average render time exceeds the frame budget.
 *
 * 16ms = one frame at 60fps. Anything over that is dropping frames.
 * Severity scales with how far over budget the component is:
 *   - warning: over threshold but under 2x
 *   - critical: 2x or more over threshold (32ms+ at default)
 */
export function check(
  name: string,
  data: ComponentPerfData,
  thresholds: PerfLensThresholds,
): Insight[] {
  // need at least 2 renders for a meaningful average — one mount
  // doesn't tell you much, the component might just be expensive to initialize
  if (data.renderCount < 2) return [];

  // avgDuration is 0 for hook-only tracking (no Profiler data)
  if (data.avgDuration <= 0) return [];

  const threshold = thresholds.slowRenderMs;
  if (data.avgDuration <= threshold) return [];

  const severity = data.avgDuration >= threshold * 2 ? 'critical' : 'warning';
  const avgRounded = Math.round(data.avgDuration * 100) / 100;
  const maxRounded = Math.round(data.maxDuration * 100) / 100;

  return [
    {
      id: insightId('slow-render', name),
      type: 'slow-render',
      severity,
      componentName: name,
      title: `<${name}> averages ${avgRounded}ms per render`,
      description:
        severity === 'critical'
          ? `This component is consistently blowing the ${threshold}ms frame budget. ` +
            `Worst case was ${maxRounded}ms. Users are seeing jank.`
          : `Averaging ${avgRounded}ms puts this component over the ${threshold}ms frame budget. ` +
            `Not critical yet, but worth investigating before it gets worse.`,
      suggestion:
        data.maxDuration > threshold * 3
          ? `Peak of ${maxRounded}ms suggests a heavy operation in the render path. ` +
            `Move expensive work into useMemo, or split the component so the slow part ` +
            `doesn't block the fast parts.`
          : `Check for inline object/array creation, unguarded computations, or DOM-heavy ` +
            `output. React DevTools Profiler can show you exactly where the time goes.`,
      data: {
        type: 'slow-render',
        avgDuration: data.avgDuration,
        maxDuration: data.maxDuration,
        frameBudgetMs: threshold,
      },
      createdAt: performance.now(),
      dismissed: false,
    },
  ];
}
