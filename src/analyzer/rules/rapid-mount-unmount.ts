import type { ComponentPerfData, Insight, PerfLensThresholds, RenderEvent } from '../../types';
import type { CircularBuffer } from '../../core/circular-buffer';
import { insightId } from '../utils';

/**
 * Flags components that keep getting destroyed and recreated.
 *
 * Usually caused by unstable `key` props or conditional rendering
 * that flips too fast. Each cycle throws away all component state,
 * runs cleanup effects, and re-initializes everything from scratch.
 * Expensive and almost always a bug.
 *
 * We count mount-phase events in the time window — each mount after
 * the first one means the component was destroyed and recreated.
 */
export function check(
  name: string,
  data: ComponentPerfData,
  thresholds: PerfLensThresholds,
  now?: number,
): Insight[] {
  const currentTime = now ?? performance.now();
  const windowStart = currentTime - thresholds.rapidMountWindow;

  const buffer = data.recentRenders as unknown as CircularBuffer<RenderEvent>;
  const recent = buffer.itemsSince(windowStart, (e) => e.timestamp);

  // count mount-phase renders — each one is a remount
  const mountsInWindow = recent.filter((e) => e.phase === 'mount').length;

  if (mountsInWindow < thresholds.rapidMountCycles) return [];

  const windowSeconds = thresholds.rapidMountWindow / 1000;
  const cyclesPerSecond = Math.round((mountsInWindow / windowSeconds) * 10) / 10;

  const severity = mountsInWindow >= thresholds.rapidMountCycles * 2 ? 'critical' : 'warning';

  return [
    {
      id: insightId('rapid-mount-unmount', name),
      type: 'rapid-mount-unmount',
      severity,
      componentName: name,
      title: `<${name}> mounted ${mountsInWindow} times in ${windowSeconds}s`,
      description:
        severity === 'critical'
          ? `${cyclesPerSecond} mount/unmount cycles per second. Every cycle ` +
            `destroys state, runs cleanup effects, and re-initializes from scratch. ` +
            `This is almost certainly a bug.`
          : `${mountsInWindow} remounts in ${windowSeconds}s is suspicious. ` +
            `Components shouldn't normally be destroyed and recreated this often.`,
      suggestion:
        `Check for dynamic \`key\` props that change on every render — ` +
        `that forces React to destroy and recreate instead of updating. ` +
        `Also look for conditional rendering (ternary or &&) that toggles ` +
        `rapidly based on state that updates in a loop or timer.`,
      data: {
        type: 'rapid-mount-unmount',
        cycles: mountsInWindow,
        timeWindowMs: thresholds.rapidMountWindow,
        cyclesPerSecond,
      },
      createdAt: currentTime,
      dismissed: false,
    },
  ];
}
