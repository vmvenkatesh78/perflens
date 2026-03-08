# Codebase Walkthrough

A file-by-file tour of the perflens source code. Every function, every pattern, every decision is explained. If you can follow this document from start to finish, you'll understand the entire codebase deeply enough to modify any part of it.

Start by reading [the guide](guide.md) first if you haven't — it explains what perflens does at a high level. This document explains how each piece of code implements that behavior.

## Reading Order

The codebase reads best bottom-up — start with the lowest-level building blocks and work up to the components that compose them.

1. `src/types.ts` — the vocabulary everything shares
2. `src/constants.ts` — default values and configuration
3. `src/core/circular-buffer.ts` — the data structure at the heart of the store
4. `src/core/store.ts` — where all render data lives
5. `src/core/profiler-callback.ts` — the bridge between React and the store
6. `src/core/provider.tsx` — the top-level component that wires everything together
7. `src/core/track.tsx` — per-component Profiler wrapper
8. `src/core/use-render-tracker.ts` — the hook alternative to PerfLensTrack
9. `src/core/use-perflens-store.ts` — consumer access to the store
10. `src/analyzer/utils.ts` — shared helpers for rules
11. `src/analyzer/engine.ts` — the orchestrator that runs all rules
12. `src/analyzer/rules/*` — individual detection rules
13. `src/panel/*` — the floating overlay UI

---

## 1. src/types.ts — The Shared Vocabulary

This file defines every interface and type used across the codebase. No logic, just shapes. Every other file imports from here.

### RenderBuffer

```typescript
export interface RenderBuffer {
  readonly count: number;
  push(item: RenderEvent): void;
  toArray(): RenderEvent[];
  itemsSince(since: number, getTime: (item: RenderEvent) => number): RenderEvent[];
  clear(): void;
}
```

This is the interface that sits between the store and the circular buffer implementation. The store works with `RenderBuffer`, not `CircularBuffer` directly. Why? Because if you typed it as `CircularBuffer`, changing the buffer implementation would be a breaking change for every consumer. The interface hides the implementation detail.

The `count` property is `readonly` — consumers can read how many events are in the buffer, but they can't set it. `push()` adds an event. `toArray()` returns a snapshot (oldest first). `itemsSince()` filters by timestamp — this is what the analyzer rules use to count events in a time window.

### RenderEvent

```typescript
export interface RenderEvent {
  timestamp: number;
  phase: RenderPhase;
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
  propsChanged: boolean | null;
}
```

One data point from React's Profiler. `actualDuration` is how long React spent rendering the component. `baseDuration` is how long it would take without memoization. `phase` is either `'mount'` (first render) or `'update'` (subsequent renders). `propsChanged` is reserved for future use — always `null` until prop capture is implemented.

### ComponentPerfData

The accumulated stats for one tracked component. This is the main data structure in the store — one entry per component, updated on every render.

Key fields: `renderCount` is a simple counter. `avgDuration` is the running average. `recentRenders` is the `RenderBuffer` holding the last N events. `isMounted` tracks whether the component is currently in the DOM. `mountUnmountCycles` counts how many times it's been destroyed and recreated.

### Insight and InsightData

```typescript
export type InsightData =
  | { type: 'excessive-rerenders'; renderCount: number; ... }
  | { type: 'slow-render'; avgDuration: number; ... }
  | ...
```

This is a discriminated union. The `type` field tells TypeScript which shape the data has. When you write `if (insight.data.type === 'slow-render')`, TypeScript narrows the type and you get autocomplete for `avgDuration` and `maxDuration`. Without the discriminated union, you'd need type assertions (`as`) everywhere.

---

## 2. src/constants.ts — Defaults

```typescript
export const DEFAULT_CONFIG = {
  enabled: true,
  panelPosition: 'bottom-right',
  toggleKey: 'ctrl+shift+p',
  maxTrackedComponents: 200,
  maxRenderEvents: 100,
  analyzerInterval: 2_000,
} as const satisfies Required<Omit<PerfLensConfig, 'thresholds' | 'onInsight'>>;
```

The `as const satisfies` pattern is worth understanding. `as const` makes every value a literal type (`'bottom-right'` instead of `string`). `satisfies` checks that the object matches the type without widening it. Together, you get compile-time validation that the defaults match the config shape, plus narrow literal types for runtime use.

`maxRenderEvents: 100` means each component's circular buffer holds 100 events. At 60fps, that's about 1.7 seconds of history. At normal render rates (a few per second), it's minutes of history. The analyzer's default time windows (5-10 seconds) fit comfortably.

---

## 3. src/core/circular-buffer.ts — The Ring Buffer

This is the most self-contained piece of the codebase. No dependencies, no React, pure data structure.

```typescript
export class CircularBuffer<T> {
  private readonly buffer: (T | undefined)[];
  private head = 0;
  private _count = 0;

  constructor(private readonly capacity: number) {
    this.buffer = new Array<T | undefined>(capacity);
  }
```

The constructor pre-allocates an array of the target size, filled with `undefined`. This is deliberate — we pay the allocation cost once, upfront. After this, `push()` never allocates.

### push()

```typescript
push(item: T): void {
  this.buffer[this.head] = item;
  this.head = (this.head + 1) % this.capacity;
  if (this._count < this.capacity) this._count++;
}
```

Write the item at the current head position, advance head by one, wrap around using modulo. If we haven't filled the buffer yet, increment count. Once full, count stays at capacity and old items get silently overwritten.

This is O(1) — constant time regardless of buffer size. No array copying, no shifting, no allocation.

### toArray()

```typescript
toArray(): T[] {
  if (this._count === 0) return [];
  if (this._count < this.capacity) {
    return this.buffer.slice(0, this._count) as T[];
  }
  return [...this.buffer.slice(this.head), ...this.buffer.slice(0, this.head)] as T[];
}
```

Two cases. If the buffer hasn't wrapped yet (count < capacity), the data is contiguous from index 0 — just slice it. If the buffer has wrapped, the oldest item is at `head` (because that's where the next write will go, overwriting the oldest). So we take everything from `head` to the end, then everything from the start to `head`. This gives us oldest-first order.

The `as T[]` cast is safe because we know these positions are filled — we only access indices up to `_count`.

### itemsSince()

```typescript
itemsSince(since: number, getTime: (item: T) => number): T[] {
  return this.toArray().filter((item) => getTime(item) >= since);
}
```

The analyzer rules use this to count events in a time window. `getTime` extracts the timestamp from each item. The filter keeps items whose timestamp is at or after `since`. It calls `toArray()` first, which allocates — this is fine because `itemsSince()` is only called by the analyzer on its 2-second interval, not on the hot render path.

---

## 4. src/core/store.ts — The Performance Data Store

The central data structure. Every other piece of perflens either writes to the store or reads from it.

### Class structure

```typescript
export class PerfStore {
  readonly components = new Map<string, ComponentPerfData>();
  insights: Insight[] = [];
  totalRenders = 0;
  readonly startedAt = performance.now();
```

`components` is a `Map`, not a plain object, because component names can be any string and Map has better performance for frequent additions and lookups. `insights` is a mutable array that the analyzer overwrites on every sweep. `startedAt` records when tracking began — used to calculate `trackingDuration` in snapshots.

### recordRender()

This is the most-called function in perflens. Every React Profiler callback ends up here.

```typescript
recordRender(name: string, event: RenderEvent): void {
  let entry = this.components.get(name);

  if (!entry) {
    this.evictIfNeeded();
    entry = createEntry(name, this.maxRenderEvents);
    this.components.set(name, entry);
  }
```

First render of a new component: check if we're at capacity, evict the oldest if needed, create a new entry, add it to the map.

```typescript
entry.renderCount++;
entry.totalDuration += event.actualDuration;
entry.avgDuration = entry.totalDuration / entry.renderCount;
```

Running average — no separate accumulator array needed. `totalDuration / renderCount` gives the average at any point. This is O(1) per render.

```typescript
entry.recentRenders.push(event);
this.totalRenders++;
```

Push the event into the circular buffer. O(1), no allocation. Increment the global counter.

### evictIfNeeded()

```typescript
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
```

LRU (Least Recently Used) eviction. When the store hits its component limit (default 200), it finds the component that hasn't rendered in the longest time and removes it. This prevents unbounded memory growth in large apps with hundreds of components.

The scan is O(n) where n is the number of tracked components, but it only runs when a new component is first seen while at capacity — not on every render. In practice, this is rare.

### snapshot()

```typescript
snapshot(): PerfLensSnapshot {
  const components: SerializedComponentPerfData[] = Array.from(
    this.components.values(),
  ).map((entry) => ({
    ...entry,
    recentRenders: entry.recentRenders.toArray(),
  }));
```

Creates a JSON-safe copy. The key transformation: `recentRenders` changes from a `RenderBuffer` (which has methods like `push()`) to a plain `RenderEvent[]`. This means `JSON.stringify(snapshot)` works. You can save it to a file, send it to a backend, or `postMessage` it to another window.

---

## 5. src/core/profiler-callback.ts — The Bridge to React

```typescript
export function createProfilerCallback(store: PerfStore): ProfilerOnRenderCallback {
  return (id, phase, actualDuration, baseDuration, startTime, commitTime) => {
    try {
      const normalizedPhase: RenderPhase = phase === 'mount' ? 'mount' : 'update';

      store.recordRender(id, {
        timestamp: performance.now(),
        phase: normalizedPhase,
        actualDuration,
        baseDuration,
        startTime,
        commitTime,
        propsChanged: null,
      });
    } catch (err) {
      if (__DEV__) {
        console.warn('[perflens] profiler callback error:', err);
      }
    }
  };
}
```

A factory that returns a callback. The callback matches React's `ProfilerOnRenderCallback` signature — React calls it with `(id, phase, actualDuration, ...)` after every commit.

Why `normalizedPhase`? React 19 added a third phase value: `'nested-update'`. Our type system only has `'mount' | 'update'`, so we bucket `'nested-update'` as `'update'`. This forward-compatibility handling means perflens works with React 18 and React 19 without changes.

The `try/catch` is critical. This callback runs inside React's commit phase. If it throws, React's error boundary might catch it and unmount your entire app. A performance tool must never crash the app it's monitoring.

---

## 6. src/core/provider.tsx — The Top-Level Wiring

This is where everything comes together.

### The two-component pattern

```typescript
export function PerfLensProvider({ children, config, enabled }: PerfLensProviderProps) {
  const isEnabled = enabled ?? config?.enabled ?? DEFAULT_CONFIG.enabled;

  if (!isEnabled) {
    return <>{children}</>;
  }

  const innerProps = config ? { config } : {};
  return <PerfLensProviderInner {...innerProps}>{children}</PerfLensProviderInner>;
}
```

The outer component is a gate. When disabled, it renders children directly — no Profiler, no context, no store. This means disabled perflens has exactly zero overhead. Not "low overhead." Zero.

The inner component does the real work:

```typescript
function PerfLensProviderInner({ children, config }) {
  const resolvedConfig = useMemo(() => resolveConfig(config), [config]);

  const storeRef = useRef<PerfStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = new PerfStore(
      resolvedConfig.maxTrackedComponents,
      resolvedConfig.maxRenderEvents,
    );
  }

  const store = storeRef.current;
```

The store lives in a `useRef`, not `useState`. This is essential. If the store were in state, every `store.recordRender()` call would need a `setState` to notify React, which would trigger a re-render of the provider, which would trigger more Profiler callbacks, creating an infinite loop. A ref holds a mutable value that React doesn't know about — exactly what we need.

### The analyzer timer

```typescript
useEffect(() => {
  const id = setInterval(() => {
    if (store.components.size === 0) return;

    const newInsights = runAnalyzer(store.components, resolvedConfig.thresholds);
    const previousIds = new Set(store.insights.map((i) => i.id));
    const fresh = newInsights.filter((i) => !previousIds.has(i.id));

    store.insights = newInsights;

    if (resolvedConfig.onInsight && fresh.length > 0) {
      for (const insight of fresh) {
        resolvedConfig.onInsight(insight);
      }
    }
  }, resolvedConfig.analyzerInterval);

  return () => clearInterval(id);
}, [resolvedConfig, store]);
```

Every `analyzerInterval` milliseconds (default 2000), the analyzer sweeps all tracked components. It replaces the entire `store.insights` array (not appending — replacing). Then it figures out which insights are genuinely new (not present in the previous sweep) and fires the `onInsight` callback for each one.

The `return () => clearInterval(id)` is the cleanup function — when the provider unmounts or `resolvedConfig` changes, the old interval is cleared before a new one starts. This prevents memory leaks from orphaned timers.

---

## 7. src/core/track.tsx — Per-Component Profiler Wrapper

```typescript
export function PerfLensTrack({ name, children }: PerfLensTrackProps) {
  const { store } = usePerfLensContext();

  const handleRender = useCallback(
    (_id, phase, actualDuration, baseDuration, startTime, commitTime) => {
      store.recordRender(name, { ... });
    },
    [store, name],
  );

  return (
    <Profiler id={name} onRender={handleRender}>
      {children}
    </Profiler>
  );
}
```

Wraps children with a `<Profiler>`. Each `PerfLensTrack` gets its own Profiler instance, so its timing data is isolated from the rest of the app. The `id` prop on Profiler doesn't have to match the `name` prop on `PerfLensTrack`, but we use the same value for consistency.

`useCallback` is important here. Without it, `handleRender` would be a new function on every render, and React would do unnecessary bookkeeping for the Profiler's `onRender` prop. With `useCallback`, the function reference is stable as long as `store` and `name` don't change.

---

## 8. src/core/use-render-tracker.ts — The Hook Alternative

```typescript
export function useRenderTracker(componentName: string, options?: UseRenderTrackerOptions): void {
  const { store } = usePerfLensContext();
  const renderCountRef = useRef(0);
  const ignore = options?.ignore ?? false;

  useEffect(() => {
    if (ignore) return;
    store.recordRender(componentName, { actualDuration: 0, ... });
    renderCountRef.current++;
  });
```

The effect has no dependency array — it runs after every render. Each render records an event with `actualDuration: 0` because hooks can't access Profiler timing data (that requires the `<Profiler>` component).

The `ignore` guard is inside the effect, not before it. In an earlier version, the guard was a conditional return before the hooks, which violated React's rules of hooks. The fix was to move the guard inside each effect. This is a real bug that was caught during the code audit — read [ADR-009](decisions.md#adr-009-no-trackprops-in-v02x-v030) for the full story.

---

## 9. src/analyzer/engine.ts — The Rule Orchestrator

```typescript
export function runAnalyzer(
  components: Map<string, ComponentPerfData>,
  thresholds: PerfLensThresholds,
): Insight[] {
  const seen = new Map<string, Insight>();

  for (const [name, data] of components) {
    for (const rule of rules) {
      const hits = rule.check(name, data, thresholds);
      for (const insight of hits) {
        seen.set(insight.id, insight);
      }
    }
  }

  return Array.from(seen.values()).sort(bySeverity);
}
```

Double loop: for each component, run each rule. Rules return `Insight[]` — usually 0 or 1 items. Results go into a `Map` keyed by insight ID. If the same rule fires for the same component across multiple sweeps, the latest insight replaces the previous one (because `Map.set` overwrites).

The `try/catch` around each rule (omitted for brevity — see the source) means one buggy rule doesn't crash the entire analyzer. This is defensive programming appropriate for a plugin-like system.

---

## 10. src/analyzer/rules/\* — Detection Rules

Each rule file exports a single `check()` function. The pattern is identical across all four implemented rules. Let's walk through `excessive-rerenders.ts` as the example:

```typescript
export function check(
  name: string,
  data: ComponentPerfData,
  thresholds: PerfLensThresholds,
  now?: number,
): Insight[] {
  const currentTime = now ?? performance.now();
  const windowStart = currentTime - thresholds.excessiveRenderWindow;

  const recent = data.recentRenders.itemsSince(windowStart, (e) => e.timestamp);

  if (recent.length < thresholds.excessiveRenderCount) return [];
```

1. Calculate the start of the time window (current time minus window size).
2. Query the buffer for events in that window.
3. If the count is below threshold, return nothing.

The `now` parameter exists for testing — inject a fixed time so tests are deterministic. In production, it defaults to `performance.now()`.

```typescript
const severity = recent.length >= threshold * 2 ? 'critical' : 'warning';
```

The severity escalation pattern is consistent across all rules: at threshold = warning, at 2x threshold = critical. This makes severity predictable and easy to explain.

```typescript
return [
  {
    id: insightId('excessive-rerenders', name),
    type: 'excessive-rerenders',
    severity,
    componentName: name,
    title: `<${name}> rendered ${recent.length} times in ${windowSeconds}s`,
    description: severity === 'critical' ? '...' : '...',
    suggestion: rendersPerSecond > 10 ? '...' : '...',
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
```

The insight is a complete, self-contained description of the problem. The `title` is a one-line summary. The `description` explains why it matters. The `suggestion` tells you what to do. The `data` field carries the raw numbers for programmatic access (e.g., piping to analytics).

The `description` and `suggestion` vary based on severity and the specific numbers. A component rendering at 15/sec gets different advice than one at 3/sec, even though both trigger the same rule.

---

## 11. src/panel/\* — The Floating Overlay

### PerfLensPanel.tsx

The main shell component. Manages four concerns:

**Portal creation** — done in a `useEffect` with cleanup, so the DOM element is added when the component mounts and removed when it unmounts. Earlier versions created the portal during render, which was a side effect bug.

**Keyboard toggle** — parses the config string (e.g., `'ctrl+shift+p'`) into modifier flags and key name. Registers a `keydown` listener on `document`. The listener toggles visibility state.

**Polling** — when visible, starts a `setInterval` that reads from the store every 500ms. When hidden, the interval is cleared. No work happens when the panel is closed.

**Focus management** — when the panel opens, it saves the previously focused element and focuses the panel. When the panel closes, it restores focus to the previous element. This is an accessibility requirement — keyboard users need to be able to return to where they were.

### ComponentTable.tsx

A simple HTML table with proper accessibility:

- `scope="col"` on header cells so screen readers associate headers with data cells
- Status indicator uses both color and text ("slow", "hot", "ok") — color alone would be invisible to colorblind users
- Thresholds come from context, not hardcoded numbers — the table matches whatever the user configured

### InsightList.tsx

A list of insights with severity badges:

- Semantic `<ul>` with `role="list"` and `aria-label`
- Severity badges have `role="status"` so screen readers announce them
- No emoji in the suggestion text — the previous version used a lightbulb emoji which screen readers would announce as "light bulb" before every suggestion

---

## Test Structure

Tests mirror the source:

```
tests/
├── core/
│   ├── circular-buffer.test.ts    # 8 tests
│   ├── profiler-callback.test.ts  # 3 tests
│   ├── provider.test.tsx          # 6 tests
│   ├── store.test.ts              # 12 tests
│   ├── track.test.ts              # 4 tests
│   ├── use-perflens-store.test.ts # 4 tests
│   └── use-render-tracker.test.ts # 12 tests
├── analyzer/
│   ├── engine.test.ts             # 7 tests
│   ├── excessive-rerenders.test.ts# 9 tests
│   ├── rapid-mount-unmount.test.ts# 9 tests
│   ├── slow-render.test.ts        # 10 tests
│   └── wasted-memo.test.ts        # 12 tests
└── setup.ts
```

Each test file has a `makeComponent()` or `makeEvent()` factory that creates test data with sensible defaults and allows overrides. This pattern lets tests focus on the specific field they're testing without repeating boilerplate.

Tests describe behavior, not implementation. Test names read as sentences: "does not flag components under the threshold", "records unmount on cleanup", "produces a JSON-serializable snapshot". A non-developer could read these names and understand what the system promises.

---

## Build and Release

- `tsup` bundles the source into ESM (`.js`) and CJS (`.cjs`) formats with TypeScript declaration files (`.d.ts`). Two entry points: `index` and `panel`.
- `size-limit` checks the bundle size on every build. Core must stay under 5KB, full under 40KB.
- `publint` validates the package.json `exports` map before publishing. Catches misconfigurations that would break consumers.
- `prepublishOnly` script runs `build` + `validate` automatically before `npm publish` — you can't publish a broken package.

---

## What to Read Next

If you want to add a new analyzer rule, read `src/analyzer/rules/slow-render.ts` (simplest rule) and `tests/analyzer/slow-render.test.ts`. Follow the same pattern.

If you want to modify the panel, read `src/panel/PerfLensPanel.tsx` for the shell and `src/panel/ComponentTable.tsx` for the data display pattern.

If you want to understand the architectural reasoning behind any decision, read [decisions.md](decisions.md).
