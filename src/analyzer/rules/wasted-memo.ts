import type { ComponentPerfData, Insight, PerfLensThresholds } from '../../types';
import { insightId } from '../utils';

/**
 * Flags components where React.memo (or useMemo) isn't saving enough
 * to justify the prop comparison overhead.
 *
 * How it works: React's Profiler gives us baseDuration (estimated cost
 * without memoization) and actualDuration (what it actually cost). If
 * actualDuration is consistently close to baseDuration, the component
 * re-renders every time anyway and memo is just adding overhead.
 *
 * Threshold default is 10% — if memo saves less than 10% of render
 * time, it's probably not worth keeping.
 */
export function check(
  name: string,
  data: ComponentPerfData,
  thresholds: PerfLensThresholds,
): Insight[] {
  // need real Profiler data, not hook-only tracking
  if (data.avgDuration <= 0 || data.lastBaseDuration <= 0) return [];

  // need enough renders to spot a pattern, not just a single mount
  if (data.renderCount < 3) return [];

  const savingsPercent = ((data.lastBaseDuration - data.avgDuration) / data.lastBaseDuration) * 100;

  // positive savings above threshold = memo is doing its job
  if (savingsPercent >= thresholds.memoSavingsThreshold) return [];

  // negative savings means actual > base, which can happen briefly
  // after a heavy re-render. clamp to 0 for the display.
  const displaySavings = Math.max(0, Math.round(savingsPercent * 10) / 10);

  // if the component renders in under 1ms anyway, memo overhead isn't
  // worth worrying about — the comparison cost dominates at that scale
  const isTrivial = data.avgDuration < 1 && data.lastBaseDuration < 1;
  const severity = isTrivial ? 'info' : 'warning';

  return [
    {
      id: insightId('wasted-memo', name),
      type: 'wasted-memo',
      severity,
      componentName: name,
      title: isTrivial
        ? `<${name}> is memo'd but renders in <1ms — memo overhead may exceed render cost`
        : `<${name}> memoization only saves ${displaySavings}%`,
      description: isTrivial
        ? `This component is so cheap to render that the prop comparison ` +
          `React.memo runs on every parent render probably costs more than ` +
          `just re-rendering it.`
        : `The gap between what this component costs with and without memoization ` +
          `is only ${displaySavings}%. That means the component re-renders almost ` +
          `every time anyway — its props keep changing.`,
      suggestion: isTrivial
        ? `Remove React.memo from trivial components. The comparison overhead ` +
          `isn't worth it when the component itself costs nearly nothing.`
        : `Either stabilize the props being passed (useMemo for objects, useCallback ` +
          `for functions) so memo can actually skip renders, or remove the memo ` +
          `wrapper since it's not helping.`,
      data: {
        type: 'wasted-memo',
        actualDuration: data.avgDuration,
        baseDuration: data.lastBaseDuration,
        savingsPercent: displaySavings,
      },
      createdAt: performance.now(),
      dismissed: false,
    },
  ];
}
