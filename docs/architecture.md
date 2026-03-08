# Architecture

perflens has three layers. Each one communicates through the types defined in `src/types.ts`. No layer depends on a layer above it — core doesn't know about the analyzer, the analyzer doesn't know about the panel.

```
┌─────────────────────────────────────────────────┐
│  Panel (src/panel/)                             │
│  Reads store on a 500ms timer. Renders via      │
│  portal. Never writes to the store.             │
├─────────────────────────────────────────────────┤
│  Analyzer (src/analyzer/)                       │
│  Pure functions. Reads store on a 2s timer.     │
│  Writes insights back to store.insights.        │
├─────────────────────────────────────────────────┤
│  Core (src/core/)                               │
│  Profiler callback → store.recordRender().      │
│  Mutable writes, no React state.                │
└─────────────────────────────────────────────────┘
```

## Core (src/core/)

The data collection layer. Every render in the tracked app flows through here.

**Files:**

- `store.ts` — `PerfStore` class. A mutable `Map<string, ComponentPerfData>` that receives render events and tracks per-component statistics. No React state is involved — this is deliberate. See [ADR-001](decisions.md#adr-001-mutable-store-over-react-state).
- `circular-buffer.ts` — `CircularBuffer<T>` class. Fixed-size ring buffer that backs each component's render history. Pre-allocates once, O(1) push, no GC pressure. See [ADR-002](decisions.md#adr-002-circular-buffer-over-dynamic-arrays).
- `profiler-callback.ts` — Factory that creates the `onRender` callback passed to React's `<Profiler>`. This is the hottest code path in perflens — it runs on every React commit. It does exactly one thing: call `store.recordRender()`.
- `provider.tsx` — `PerfLensProvider` component. Wraps the app with a `<Profiler>`, creates the store (in a ref), starts the analyzer timer, and provides the store via context. When `enabled` is `false`, it renders children directly with zero overhead.
- `track.tsx` — `PerfLensTrack` component. Wraps a subtree with its own `<Profiler>` for per-component timing. This is how you get `actualDuration` and `baseDuration` for a specific component rather than the whole tree.
- `use-render-tracker.ts` — `useRenderTracker` hook. Counts renders and tracks mount/unmount from inside a component. Cannot measure timing (React limitation — the Profiler API is a component, not a hook).
- `use-perflens-store.ts` — `usePerfLensStore` hook. Exposes the store to consumers for custom UIs or data export.

**Data flow:**

```
Your component renders
  → React calls <Profiler onRender={callback}>
    → callback calls store.recordRender(name, event)
      → store updates the component's Map entry
        → store pushes event into the component's CircularBuffer
```

This entire path is synchronous and runs inside React's commit phase. There is no `setState`, no immutable copy, no event emission. The store mutates in place. Nothing in React knows the store changed.

## Analyzer (src/analyzer/)

The insight generation layer. Pure functions that read component data and produce `Insight` objects.

**Files:**

- `engine.ts` — `runAnalyzer()` function. Loops through every tracked component, runs every active rule, deduplicates insights by ID, and sorts by severity. Called on a timer from the provider (default every 2 seconds).
- `utils.ts` — Shared helpers: `insightId()` for generating deterministic IDs, `bySeverity()` for sorting.
- `rules/slow-render.ts` — Flags components whose average render time exceeds the frame budget (16ms).
- `rules/excessive-rerenders.ts` — Flags components that render too many times in a time window. Uses `CircularBuffer.itemsSince()` for efficient time-windowed counting.
- `rules/rapid-mount-unmount.ts` — Flags components that get destroyed and recreated too fast. Counts mount-phase events in a time window.
- `rules/wasted-memo.ts` — Flags components where `React.memo` isn't saving enough to justify the prop comparison overhead. Compares `actualDuration` vs `baseDuration`.
- `rules/unnecessary-rerender.ts` — Stub. Needs prop capture system.
- `rules/render-cascade.ts` — Stub. Needs cross-component timing correlation.

**How rules work:**

Every rule exports a `check()` function with the same signature:

```typescript
function check(
  name: string,
  data: ComponentPerfData,
  thresholds: PerfLensThresholds,
  now?: number,
): Insight[];
```

The function receives one component's data and returns zero or more insights. The engine calls it for every component. If the component is healthy, the rule returns `[]`. If there's a problem, it returns an `Insight` with a severity, title, description, suggestion, and typed data payload.

**Severity escalation pattern:** Every rule uses the same formula: at threshold = warning, at 2x threshold = critical. This makes severity predictable and consistent across all rules.

**Deduplication:** Each insight has an ID in the format `type::componentName` (e.g., `slow-render::UserList`). When the analyzer runs, the latest insight for each ID wins. This means a component that was flagged 10 seconds ago gets its data refreshed on every sweep, but doesn't create duplicate entries.

## Panel (src/panel/)

The display layer. A floating overlay that renders via `createPortal` to `document.body`.

**Files:**

- `PerfLensPanel.tsx` — Main shell. Manages visibility state, keyboard toggle, polling, focus management. Renders the collapsed pill (when hidden) or the full panel (when open).
- `ComponentTable.tsx` — Table of tracked components sorted by render count. Shows name, render count, average duration, max duration, and a status indicator.
- `InsightList.tsx` — List of detected performance issues with severity badges, descriptions, and suggestions.
- `panel-utils.ts` — Pure helpers: `parseToggleKey()`, `positionStyle()`, `fmt()`, `hasLevel()`, severity color constants.

**Key design decisions:**

- Portal rendering — floats above the app regardless of CSS context. See [ADR-006](decisions.md#adr-006-portal-rendering-for-the-panel).
- Polling — reads the store every 500ms, not on every mutation. See [ADR-005](decisions.md#adr-005-polling-over-reactive-updates-for-the-panel).
- Inline styles — no external CSS, no class name collisions. Guarantees style isolation without Shadow DOM.
- Accessible — ARIA `tablist`/`tab`/`tabpanel` for the tab interface, `role="dialog"` on the panel, `aria-label` on all buttons, focus management on open/close.
- Separate entry point — doesn't bloat the core bundle. See [ADR-003](decisions.md#adr-003-separate-entry-point-for-the-panel).

## Type System

All shared types live in `src/types.ts`. Key interfaces:

- `RenderEvent` — a single Profiler callback's data.
- `RenderBuffer` — interface for the circular buffer. Exposes `push()`, `toArray()`, `itemsSince()`, `count`, `clear()`. The concrete implementation is `CircularBuffer`, but consumers interact through the interface. See [ADR-007](decisions.md#adr-007-renderbuffer-interface-over-type-assertion).
- `ComponentPerfData` — accumulated stats for one component. Contains the `RenderBuffer`, averages, counts, mount state.
- `Insight` — a detected performance issue. Discriminated union on `InsightData.type` for type-safe access to rule-specific data.
- `PerfLensConfig` — user-facing configuration. All fields optional with sensible defaults.
- `PerfLensThresholds` — tunable numbers that control when rules fire.

## Build

- **tsup** — bundles to ESM and CJS with TypeScript declaration files. Two entry points: `index` (core) and `panel` (UI).
- **size-limit** — enforces bundle budgets. Core must stay under 5KB gzipped, full under 40KB.
- **publint** — validates the package before publish. Catches misconfigured exports, missing files, wrong module formats.

## Testing

- **vitest** with jsdom — all tests run in a simulated browser environment.
- Tests mirror the `src/` structure: `tests/core/`, `tests/analyzer/`.
- Each analyzer rule has its own test file with a `makeComponent()` factory that creates `ComponentPerfData` with controlled values.
- Core tests use `@testing-library/react` for rendering hooks and components.
- 96 tests across 12 files. No test depends on another test's side effects or execution order.
