import type { ComponentPerfData, Insight, PerfLensThresholds } from '../../types';
import { insightId } from '../utils';

/**
 * Flags components that re-render too many times in a short window.
 *
 * The classic symptom: a component re-renders 40+ times because a parent
 * is setting state in useEffect, or an unstabilized context is updating
 * on every keystroke. Users see jank, CPU goes up, and nothing looks
 * obviously broken in the code.
 *
 * Uses the circular buffer's itemsSince to count recent renders without
 * scanning the entire history. Window and count thresholds are configurable.
 */
export function check(
  name: string,
  data: ComponentPerfData,
  thresholds: PerfLensThresholds,
  now?: number,
): Insight[] {
  const currentTime = now ?? performance.now();
  const windowStart = currentTime - thresholds.excessiveRenderWindow;

  // grab renders within the time window from the ring buffer
  const recent = data.recentRenders.itemsSince(windowStart, (e) => e.timestamp);

  if (recent.length < thresholds.excessiveRenderCount) return [];

  const windowSeconds = thresholds.excessiveRenderWindow / 1000;
  const rendersPerSecond = Math.round((recent.length / windowSeconds) * 10) / 10;
  const threshold = thresholds.excessiveRenderCount;

  // 2x the threshold = critical. matches the escalation pattern in slow-render.
  const severity = recent.length >= threshold * 2 ? 'critical' : 'warning';

  return [
    {
      id: insightId('excessive-rerenders', name),
      type: 'excessive-rerenders',
      severity,
      componentName: name,
      title: `<${name}> rendered ${recent.length} times in ${windowSeconds}s`,
      description:
        severity === 'critical'
          ? `${rendersPerSecond} renders/sec is way too hot. This is almost certainly ` +
            `causing visible jank — every render that doesn't produce a visible change ` +
            `is wasted CPU time.`
          : `${recent.length} renders in ${windowSeconds}s (${rendersPerSecond}/sec) is above ` +
            `the ${threshold} render threshold. Might be fine for an animation, but worth ` +
            `checking if all those renders are actually needed.`,
      suggestion:
        rendersPerSecond > 10
          ? `This component is re-rendering faster than most screens can refresh. ` +
            `Look for setState calls inside useEffect without proper deps, context ` +
            `providers that update on every render, or event handlers that aren't throttled.`
          : `Check if a parent is passing new object/array references on every render. ` +
            `React.memo can help if the component's output doesn't actually change. ` +
            `Also check for context subscriptions — if only one field changes, consider ` +
            `splitting the context.`,
      data: {
        type: 'excessive-rerenders',
        renderCount: recent.length,
        timeWindowMs: thresholds.excessiveRenderWindow,
        rendersPerSecond,
      },
      createdAt: currentTime,
      dismissed: false,
    },
  ];
}
