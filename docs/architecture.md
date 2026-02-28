# Architecture

Three layers. Each talks through the types in `src/types.ts`.

## Core (`src/core/`)

Data collection. Profiler callback writes render events into the store. Hooks add per-component opt-in tracking. Store is a mutable Map — no React state.

## Analyzer (`src/analyzer/`)

Insight generation. Pure functions that read from the store and produce Insights. One file per rule under `rules/`. Engine runs them on a debounced interval.

## UI (`src/panel/`, `src/detail/`)

Display. Panel polls the store on a timer. Detail view opens in a new tab via `window.open()` + `postMessage`.

## Data Flow

```
Component renders
  -> Profiler onRender
    -> store.recordRender() [mutable write, no setState]
      -> analyzer on interval [reads store, produces insights]
        -> panel on interval [reads store, renders UI]
```
