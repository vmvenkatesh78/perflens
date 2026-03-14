import type { ComponentPerfData, Insight, PerfLensThresholds } from '../../types';
import { insightId } from '../utils';

/**
 * Flags components that re-render without their props changing.
 *
 * Requires the consumer to pass `props` to `useRenderTracker`:
 *   useRenderTracker('UserList', { props: { users, onSelect } })
 *
 * When props are tracked, each render event records whether props
 * changed (shallow comparison). This rule counts update renders
 * where propsChanged === false — those renders could have been
 * avoided with React.memo.
 *
 * Only fires if prop tracking is active (at least some events
 * have propsChanged !== null) and the unnecessary ratio exceeds
 * the configured threshold.
 */
export function check(
  name: string,
  data: ComponentPerfData,
  thresholds: PerfLensThresholds,
  now?: number,
): Insight[] {
  const currentTime = now ?? performance.now();
  const windowStart = currentTime - thresholds.excessiveRenderWindow;

  const recent = data.recentRenders.itemsSince(windowStart, (e) => e.timestamp);

  // only look at update renders where prop tracking was active
  const trackedUpdates = recent.filter((e) => e.phase === 'update' && e.propsChanged !== null);

  // not enough data — either prop tracking isn't enabled or not enough renders
  if (trackedUpdates.length < thresholds.unnecessaryRerenderMinCount) return [];

  const unnecessary = trackedUpdates.filter((e) => e.propsChanged === false);
  const ratio = (unnecessary.length / trackedUpdates.length) * 100;

  if (ratio < thresholds.unnecessaryRerenderRatio) return [];

  const ratioRounded = Math.round(ratio);
  const wastedMs = unnecessary.reduce((sum, e) => sum + e.actualDuration, 0);
  const wastedRounded = Math.round(wastedMs * 100) / 100;

  // critical if > 75% unnecessary, warning if > threshold (default 50%)
  const severity = ratio >= 75 ? 'critical' : 'warning';

  return [
    {
      id: insightId('unnecessary-rerender', name),
      type: 'unnecessary-rerender',
      severity,
      componentName: name,
      title: `<${name}> re-rendered ${unnecessary.length}/${trackedUpdates.length} times without prop changes`,
      description:
        severity === 'critical'
          ? `${ratioRounded}% of this component's renders were unnecessary — props didn't ` +
            `change, but the component re-rendered anyway. ` +
            `${wastedMs > 0 ? `That wasted ${wastedRounded}ms of render time.` : 'Wrap it in React.memo to skip these renders.'}`
          : `${ratioRounded}% of recent renders happened despite props being the same. ` +
            `This component is doing work it doesn't need to do.`,
      suggestion:
        wastedMs > 16
          ? `Wrap this component in React.memo — it would have skipped ` +
            `${unnecessary.length} renders and saved ${wastedRounded}ms. Also check ` +
            `if the parent is passing new object/array references or inline functions ` +
            `on every render.`
          : `Wrap this component in React.memo to skip re-renders when props ` +
            `haven't changed. If props include objects or functions, stabilize them ` +
            `with useMemo and useCallback in the parent.`,
      data: {
        type: 'unnecessary-rerender',
        totalUnnecessary: unnecessary.length,
        totalRenders: trackedUpdates.length,
        wastedMs: wastedRounded,
      },
      createdAt: currentTime,
      dismissed: false,
    },
  ];
}
