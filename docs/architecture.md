# Architecture

Three layers. Each talks through the types in `src/types.ts`.

## Core (`src/core/`)

Data collection layer. The Profiler callback writes render events into the store on every commit. Hooks add per-component opt-in tracking (render count, mount/unmount, prop changes). The store is a mutable Map — no React state, no immutable copies, no GC pressure.

Why mutable: the Profiler callback fires on every React commit. If we created a new state object each time, we'd trigger re-renders in the provider on every tracked render. That defeats the purpose of a perf tool.

## Analyzer (`src/analyzer/`)

Insight generation. Pure functions that read from the store and produce `Insight` objects. One file per rule under `rules/`. The engine runs all active rules on a configurable interval (default 2s), deduplicates by insight ID, and sorts by severity.

Adding a new rule: write a `check()` function that returns `Insight[]`, add a test file, import it in `engine.ts`, push it into the `rules` array. That's it.

Current rules: `slow-render`, `excessive-rerenders`, `rapid-mount-unmount`, `wasted-memo`. Planned: `unnecessary-rerender` (needs prop capture), `render-cascade` (needs cross-component correlation).

## UI (`src/panel/`, `src/detail/`)

Display layer. Panel polls the store on a timer (not per mutation — that would be expensive). Detail view will open in a new tab via `window.open()` + `postMessage`. Both are planned for v0.2.0.

## Data Flow

```
Component renders
  → Profiler onRender
    → store.recordRender()       [mutable write, no setState]
      → analyzer on interval     [reads store, produces insights]
        → panel on interval      [reads store + insights, renders UI]
```

Every step after the Profiler callback is decoupled from React's render cycle. The store never triggers re-renders. The analyzer never blocks the main thread during a render. The panel reads on its own schedule.
