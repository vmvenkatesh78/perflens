# Changelog

## [Unreleased]

### Changed
- `useRenderTracker` no longer calls `recordRender` — Profiler handles all timing
- Removed `profiledRenderCount` from `ComponentPerfData` (was splitting hook vs Profiler renders, unnecessary)
- Prop change detection wired into `useRenderTracker` (was a no-op before)

### Improved
- Human-readable JSDoc across all public APIs
- Better inline comments explaining "why" not "what"

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
