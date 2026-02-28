# Changelog

## [Unreleased]

## [0.2.1] - 2026-02-28

Patch release — npm package name fix and documentation corrections.

### Fixed
- Package renamed to `react-perflens` on npm (`perflens` was blocked by registry)
- README install command and import paths now reference `react-perflens`
- Package name in package.json synced with npm registry

## [0.2.0] - 2026-02-28

First npm publish. Core tracking, 4 analyzer rules, and floating panel.

### Added
- `PerfLensPanel` — floating overlay with component table and insight list
  - Keyboard toggle (Ctrl+Shift+P, configurable)
  - Collapsible pill mode with insight count badge
  - Tabs for components and insights
  - Export snapshot to JSON, clear data
  - Configurable corner position
- Panel ships as separate entry point (`perflens/panel`) to keep core bundle lean
- Analyzer engine — sweeps tracked components on a 2s interval
- `slow-render` rule — flags components over the 16ms frame budget
- `excessive-rerenders` rule — counts renders in a sliding time window
- `rapid-mount-unmount` rule — catches destroy-recreate loops
- `wasted-memo` rule — detects memoization that isn't saving enough
- `onInsight` callback for piping insights to analytics or logging
- 96 tests across 12 test files

### Changed
- `PerfLensPanel` moved from `perflens` to `perflens/panel` import path
- `useRenderTracker` simplified — Profiler handles timing, hook handles counting
- Removed `profiledRenderCount` from `ComponentPerfData`

### Bundle size
- Core: 3.73 KB gzipped
- Full (with panel): 7.96 KB gzipped

## [0.1.0] - 2026-02-22

### Added
- `PerfLensProvider` — wraps app with Profiler, zero overhead when disabled
- `PerfLensTrack` — per-component Profiler wrapper for timing data
- `useRenderTracker` — hook for render counting, mount/unmount tracking
- `usePerfLensStore` — read store data programmatically
- Mutable Map-based store with circular buffer per component
- Component eviction when at capacity (LRU by last render time)
- Serializable snapshots for JSON export
- Playground app with 6 anti-pattern test components
- CI pipeline (lint, typecheck, test, build, size check)
- Full TypeScript strict mode, zero `any`

### Design decisions
- Mutable store over Redux/Zustand — avoids GC pressure at high write rates
- Circular buffer over arrays — bounded memory per component
- Interval-based panel reads over reactive updates — decouples write/render frequency
