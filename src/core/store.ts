import type { ComponentPerfData, RenderEvent, Insight, PerfLensSnapshot } from '../types';
import { VERSION } from '../constants';
import { CircularBuffer } from './circular-buffer';

/**
 * Mutable perf data store. Writes on every render (Profiler callback),
 * reads on a timer (panel). No React state involved.
 */
export class PerfStore {
  readonly components = new Map<string, ComponentPerfData>();
  insights: Insight[] = [];
  totalRenders = 0;
  readonly startedAt = performance.now();

  constructor(
    private readonly maxComponents: number,
    private readonly maxRenderEvents: number,
  ) {}

  recordRender(name: string, event: RenderEvent): void {
    let entry = this.components.get(name);

    if (!entry) {
      this.evictIfNeeded();
      entry = createEntry(name, this.maxRenderEvents);
      this.components.set(name, entry);
    }

    entry.renderCount++;
    entry.lastRenderAt = event.timestamp;

    // -1 means no Profiler data (hook-level tracking only). skip duration math.
    if (event.actualDuration >= 0) {
      entry.profiledRenderCount++;
      entry.totalDuration += event.actualDuration;
      entry.avgDuration = entry.totalDuration / entry.profiledRenderCount;
      entry.lastDuration = event.actualDuration;
      entry.lastBaseDuration = event.baseDuration;

      if (event.actualDuration > entry.maxDuration) {
        entry.maxDuration = event.actualDuration;
      }
    }

    if (event.phase === 'mount') {
      entry.mountCount++;
      entry.isMounted = true;
    } else {
      entry.updateCount++;
    }

    (entry.recentRenders as unknown as CircularBuffer<RenderEvent>).push(event);
    this.totalRenders++;
  }

  recordUnmount(name: string): void {
    const entry = this.components.get(name);
    if (!entry) return;

    entry.isMounted = false;
    entry.mountUnmountCycles++;
  }

  storeProps(name: string, props: Record<string, unknown>): void {
    const entry = this.components.get(name);
    if (!entry) return;
    entry.prevProps = { ...props };
  }

  getPrevProps(name: string): Record<string, unknown> | null {
    return this.components.get(name)?.prevProps ?? null;
  }

  clear(): void {
    this.components.clear();
    this.insights = [];
    this.totalRenders = 0;
  }

  snapshot(): PerfLensSnapshot {
    const components = Array.from(this.components.values()).map((entry) => ({
      ...entry,
      recentRenders: (
        entry.recentRenders as unknown as CircularBuffer<RenderEvent>
      ).toArray(),
    }));

    return {
      components,
      insights: [...this.insights],
      metadata: {
        capturedAt: performance.now(),
        trackingDuration: performance.now() - this.startedAt,
        totalRenders: this.totalRenders,
        perflensVersion: VERSION,
      },
    };
  }

  private evictIfNeeded(): void {
    if (this.components.size < this.maxComponents) return;

    let oldest: string | null = null;
    let oldestTime = Infinity;

    for (const [name, data] of this.components) {
      if (data.lastRenderAt < oldestTime) {
        oldestTime = data.lastRenderAt;
        oldest = name;
      }
    }

    if (oldest) {
      this.components.delete(oldest);
    }
  }
}

function createEntry(name: string, bufferSize: number): ComponentPerfData {
  const now = performance.now();
  return {
    name,
    renderCount: 0,
    mountCount: 0,
    updateCount: 0,
    lastDuration: 0,
    avgDuration: 0,
    maxDuration: 0,
    totalDuration: 0,
    lastBaseDuration: 0,
    profiledRenderCount: 0,
    firstRenderAt: now,
    lastRenderAt: now,
    recentRenders: new CircularBuffer<RenderEvent>(bufferSize) as unknown as RenderEvent[],
    prevProps: null,
    isMounted: false,
    mountUnmountCycles: 0,
  };
}
