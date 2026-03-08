# Architecture Decisions

Every significant technical decision in perflens, why it was made, what was considered, and what trade-off it accepts. Read this if you want to understand not just what the code does, but why it's shaped the way it is.

## ADR-001: Mutable Store Over React State

**Decision:** The performance data store is a plain mutable class (`PerfStore`) using a `Map`. It does not use React state, Zustand, Jotai, Redux, or any reactive state system.

**Context:** The React Profiler `onRender` callback fires on every commit. In a busy app, that can be hundreds of times per second. If each write triggered a React state update, we would cause re-renders in the provider, which would trigger more Profiler callbacks, which would cause more state updates. A performance monitoring tool that degrades performance is useless.

**Alternatives considered:**

- **Zustand** — Lightweight, supports subscriptions without re-renders. Rejected because it's a runtime dependency. perflens has zero dependencies by design, and Zustand adds ~1.5KB. The subscription model would also couple write frequency to read frequency, which we explicitly want to avoid (see ADR-005).
- **useRef + forceUpdate** — Store data in a ref, trigger re-renders manually. Rejected because it still couples the write path (Profiler callback) to React's render cycle. The ref avoids immutable copies but forceUpdate still costs a reconciliation pass.
- **External event emitter** — Store emits events, consumers subscribe. Considered viable but over-engineered for the use case. The panel polls on a timer anyway (ADR-005), so push-based updates add complexity with no benefit.

**Trade-off:** Consumers who call `usePerfLensStore()` get a reference to the live store. The data can change between renders without React knowing. This is intentional — the panel handles it by polling. Custom consumers need to understand that the store is a live mutable object, not a React-managed snapshot. The `snapshot()` method exists for consumers who need a frozen copy.

---

## ADR-002: Circular Buffer Over Dynamic Arrays

**Decision:** Each component's render history is stored in a `CircularBuffer<RenderEvent>` with a fixed capacity (default 100 events).

**Context:** Components can render thousands of times in a long session. Storing every event in a growing array means unbounded memory growth. In a dashboard that runs for hours, this becomes a real problem — we observed arrays growing past 50,000 entries in stress tests, consuming 40MB+ for a single component.

**Alternatives considered:**

- **Growing array with periodic trim** — Push to an array, trim to the last N entries every K seconds. Rejected because trimming creates GC pressure (the old array segment needs to be collected) and the timing is awkward — do you trim during a render? Between renders? Either way, you have a window where the array is oversized.
- **Sliding window by time** — Only keep events from the last N seconds. Rejected because it makes the data structure time-dependent — you need a timer to evict stale entries, and the window size affects memory differently depending on render frequency. A fixed-count buffer has predictable memory regardless of render rate.
- **WeakRef-based eviction** — Let the GC decide. Rejected because `WeakRef` to plain objects doesn't work (the GC can collect them immediately), and the approach gives you no control over retention.

**Trade-off:** Fixed capacity means old data is silently overwritten. If a component rendered 200 times and the buffer holds 100, you only see the most recent 100. This is acceptable because the analyzer rules use time-windowed queries (`itemsSince`), not full-history scans. The buffer is large enough that any reasonable time window (5-30 seconds) fits entirely within it at normal render rates.

**Implementation detail:** The buffer pre-allocates its internal array once at construction. Push is O(1) — write to the next slot and advance the head pointer. No allocation, no GC pressure after init. `toArray()` does allocate (it stitches the two halves), but it's only called by the panel on its 500ms poll cycle, not on the hot write path.

---

## ADR-003: Separate Entry Point for the Panel

**Decision:** The panel UI ships as `react-perflens/panel`, a separate entry point from the core `react-perflens` import.

**Context:** Not every consumer wants the panel. Some use perflens programmatically — tracking render data and piping it to analytics via `onInsight` or `usePerfLensStore`. Bundling the panel (13KB unminified) with the core (3KB) penalizes those consumers.

**Alternatives considered:**

- **Single entry point with tree-shaking** — Export everything from one entry and let bundlers tree-shake unused code. Rejected because tree-shaking React components is unreliable. If the panel imports from the same module as the hooks, most bundlers will include the panel code even if it's never used. Vite and webpack both struggle with this when JSX is involved.
- **Lazy loading via `React.lazy`** — Keep one entry point, lazy-load the panel. Rejected because it adds runtime complexity (Suspense boundary, loading state) for something that should be a build-time decision. If you don't want the panel, you shouldn't have to pay for the lazy-loading infrastructure either.

**Trade-off:** Consumers need two import statements instead of one. The README makes this clear, and the error message if you import from the wrong path is obvious. The bundle size win (3.63KB core vs 8.26KB full) justifies the minor ergonomic cost.

**How it works in tsup:**

```typescript
entry: {
  index: 'src/index.ts',
  panel: 'src/panel/index.ts',
}
```

tsup generates shared chunks for code used by both entry points (types, constants). Each entry only pulls in what it needs. The `exports` field in `package.json` maps `react-perflens` to `dist/index.js` and `react-perflens/panel` to `dist/panel.js`.

---

## ADR-004: React Profiler API Over Fiber Internals

**Decision:** perflens uses React's public `<Profiler>` component API for render timing data. It does not access React internals, the fiber tree, or any undocumented APIs.

**Context:** React's Profiler component provides `actualDuration`, `baseDuration`, `startTime`, and `commitTime` for each render. This is enough to detect slow renders, calculate averages, and compare memoized vs unmemoized cost. Tools like react-scan and Why Did You Render access React's internal fiber tree for deeper data (which specific prop changed, the component hierarchy, parent-child render relationships).

**Alternatives considered:**

- **Fiber tree traversal** — Walk `_reactInternals` on component instances. Gives you the full render tree, prop diffs, state diffs. Rejected because these are private APIs that can break between React versions without notice. React 18 changed the fiber structure. React 19 changed it again. A tool that breaks on every React upgrade is a maintenance burden its users shouldn't bear.
- **Monkey-patching React.createElement** — Intercept component creation to track renders. Used by Why Did You Render. Rejected for the same stability reason, plus it adds overhead to every createElement call in the app, not just tracked components.

**Trade-off:** We get less data than fiber-based tools. We can't tell you which specific prop changed (without the prop capture system, which is deferred). We can't trace the parent that caused a child to re-render. We can't build a component tree visualization. What we can do is measure timing, count renders, detect patterns, and give actionable suggestions — all with an API that won't break on React upgrades.

**Future path:** The `unnecessary-rerender` rule (currently stubbed) needs prop change detection. The plan is to use a ref-based prop capture system — store the previous props via a ref in `useRenderTracker`, shallow-compare on the next render. This stays within public APIs. The `render-cascade` rule needs cross-component timing correlation, which can be done by comparing `commitTime` values across components in the same store — no fiber access needed.

---

## ADR-005: Polling Over Reactive Updates for the Panel

**Decision:** The panel reads from the store on a 500ms interval (`setInterval`). It does not subscribe to store mutations or use any push-based notification system.

**Context:** The store can receive hundreds of writes per second during heavy rendering. The panel only needs to display a summary — total renders, averages, insight list. Updating the panel on every write would cause it to re-render at the same rate as the busiest component in the app. That makes the panel itself a performance problem.

**Alternatives considered:**

- **Store subscription with throttle** — Emit events on write, throttle the listener. Works, but adds complexity to the store (event emitter pattern) and the throttle interval is effectively the same as a poll interval. The code would be more complex for identical behavior.
- **React useSyncExternalStore** — React 18's recommended pattern for external stores. Rejected because it re-renders every time the store changes, and the store changes on every Profiler callback. You'd need to add your own batching or throttling on top, which brings you back to a timer.
- **requestAnimationFrame** — Read on each frame. 60fps = 60 reads per second. Overkill for a data table that humans can't process faster than twice per second anyway.

**Trade-off:** The panel shows data that's up to 500ms stale. For a development tool that displays counts, averages, and insight text, this is imperceptible. The benefit is that panel rendering is completely decoupled from app rendering. A component that renders 1000 times per second causes exactly 0 extra panel renders.

---

## ADR-006: Portal Rendering for the Panel

**Decision:** The panel renders via `createPortal` to a dedicated `<div>` appended to `document.body`.

**Context:** The panel needs to float above the host app without being affected by the app's CSS, z-index stacking contexts, or overflow rules. If the panel rendered inside the React tree normally, a parent with `overflow: hidden` or a low `z-index` context would clip or hide it.

**Alternatives considered:**

- **Shadow DOM** — Full style isolation. Rejected because React doesn't natively support rendering into Shadow DOM, and the workarounds (custom render root) are brittle and untested with newer React versions.
- **iframe** — Complete isolation. Rejected because communicating data from the main app to an iframe requires `postMessage` serialization on every update — expensive at the poll rate we need.

**Trade-off:** The portal element is a direct child of `document.body`, which means it's technically part of the page's DOM and could be affected by global CSS resets. We mitigate this by using inline styles on every element rather than class names. No external CSS dependency, no class name collisions. The inline style approach adds weight to the component code but guarantees style isolation without Shadow DOM complexity.

---

## ADR-007: RenderBuffer Interface Over Type Assertion

**Decision (v0.3.0):** `ComponentPerfData.recentRenders` is typed as `RenderBuffer` — an interface that exposes `push()`, `toArray()`, `itemsSince()`, `count`, and `clear()`. The underlying implementation is `CircularBuffer`, but consumers interact through the interface.

**Context:** In v0.1.0-v0.2.x, `recentRenders` was typed as `RenderEvent[]` but was actually a `CircularBuffer` at runtime. This required 8 `as unknown as` casts throughout the codebase. Any consumer who accessed `.length`, `.map()`, or `.filter()` on the field would get undefined behavior or a runtime crash. The type system was actively lying.

**Alternatives considered:**

- **Expose CircularBuffer directly** — Type the field as `CircularBuffer<RenderEvent>`. Rejected because it leaks an implementation detail into the public API. If we ever change the buffer implementation, it's a breaking change for every consumer.
- **Convert to array on every write** — Call `toArray()` after each push and store the result. Rejected because it defeats the purpose of the circular buffer — you'd be creating a new array on every render, which is exactly the GC pressure the buffer was designed to avoid.

**Trade-off:** The `RenderBuffer` interface has a `push()` method, which means the type technically allows external code to push events into the buffer. This is acceptable because the store is a development tool, not a security boundary. The alternative — a separate `ReadonlyRenderBuffer` for consumers and a `WritableRenderBuffer` for internal use — adds type complexity for no practical benefit.

---

## ADR-008: exactOptionalPropertyTypes Enabled

**Decision (v0.3.0):** `exactOptionalPropertyTypes: true` in tsconfig.

**Context:** Without this flag, TypeScript allows `undefined` to be assigned to optional properties even when `undefined` isn't in the type. This means `config?: PerfLensConfig` silently accepts `config: undefined` — which can propagate through the codebase and cause subtle bugs where code expects a value but gets `undefined`.

**Alternatives considered:**

- **Keep it disabled** — Fewer type errors to deal with. Rejected because the flag caught 3 real bugs on first enable: `onInsight: config?.onInsight` assigned `undefined` to a property typed as `(insight: Insight) => void`, and the provider was passing `config={config}` when `config` could be `undefined`.

**Trade-off:** Some patterns become more verbose. You can't write `return { onInsight: config?.onInsight }` — you need to conditionally include the property. This is a feature, not a bug. The verbosity forces you to handle the `undefined` case explicitly.

---

## ADR-009: No trackProps in v0.2.x-v0.3.0

**Decision (v0.3.0):** The `trackProps` option was removed from the public API. It was present in v0.2.x but returned incorrect results.

**Context:** `trackProps` was intended to enable shallow prop comparison between renders. The implementation had a `getCurrentProps()` function that always returned `{}`, meaning every comparison showed props as "changed." A consumer who enabled the option got silently wrong data — worse than no data.

**Alternatives considered:**

- **Ship it with a warning** — Add a console.warn when `trackProps` is used. Rejected because a warning doesn't prevent the wrong data from flowing into insights and analytics pipelines. If someone pipes `onInsight` to their monitoring system, they'd get false positives.
- **Implement it properly now** — Wire up ref-based prop capture. Deferred because it requires non-trivial changes to how `useRenderTracker` captures the component's props (likely via a ref callback passed to the parent). The scope is larger than the audit timeline allows.

**Trade-off:** Consumers who were using `trackProps: true` in v0.2.x will get a TypeScript error on upgrade to v0.3.0. This is the correct outcome — the feature never worked, and a compile-time error is better than silent runtime incorrectness. The TODO in the type definition documents the v0.3.x plan.
