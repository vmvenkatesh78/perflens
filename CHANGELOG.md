# Changelog

## [Unreleased]

### Added
- Analyzer engine — sweeps tracked components on a 2s interval, produces insights
- `slow-render` rule — flags components over the 16ms frame budget
- `excessive-rerenders` rule — counts renders in a sliding time window
- `rapid-mount-unmount` rule — catches destroy-recreate loops
- `wasted-memo` rule — detects memoization that isn't saving enough
- `onInsight` callback fires for each new insight (pipe to analytics, logging, etc.)
- 30 new analyzer tests (96 total across 12 test files)

### Changed
- `useRenderTracker` no longer calls `recordRender` — Profiler handles all timing
- Removed `profiledRenderCount` from `ComponentPerfData` (unnecessary split)
- Prop change detection wired into `useRenderTracker` (was a no-op before)

### Improved
- Human-readable JSDoc across all public APIs
- Rewrote `docs/insights.md` with practical fix guidance for each rule

## [0.1.0] - 2026-02-22

### Added
- `PerfLensProvider` — wraps app with Profiler, zero overhead when disabled
- `PerfLensTrack` — per-component Profiler wrapper for timing data
- `useRenderTracker` — hook for render counting, mount/unmount tracking
- `usePerfLensStore` — read store data programmatically
- `PerfLensPanel` — stub (ships in v0.2.0)
- Mutable Map-based store with circular buffer per component
- Component eviction when at capacity (LRU by last render time)
- Serializable snapshots for JSON export
- Playground app with 6 anti-pattern test components
- 51 tests across 7 test files
- CI pipeline (lint, typecheck, test, build, size check)
- Full TypeScript strict mode, zero `any`

### Design decisions
- Mutable store over Redux/Zustand — avoids GC pressure at high write rates
- Circular buffer over arrays — bounded memory per component
- Interval-based panel reads over reactive updates — decouples write/render frequency
- `PerfLensTrack` wraps with Profiler for real timing data
