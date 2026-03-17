markdown# Changelog

## [0.5.0] - 2026-03-14

All 6 analyzer rules implemented. No stubs remaining.

### Added
- `render-cascade` rule — detects when 5+ components re-render in the same React commit. Identifies the heaviest renderer as the cascade root. Critical at 2x threshold or when total cascade duration exceeds 32ms.
- Cross-component rule pattern — engine now supports `checkAll()` rules that receive the full components map for relationship analysis.
- 13 render-cascade tests

### Changed
- Engine refactored with `ComponentRule` and `GlobalRule` interfaces
- Coverage exclusions removed — all rules now tested
- 128 tests across 15 files

### Bundle size
- Core: 4.75 KB gzipped
- Full: 10.37 KB gzipped

## [0.4.0] - 2026-03-14

### Added
- `unnecessary-rerender` rule — detects re-renders where props didn't change
- `props` option on `useRenderTracker` — pass component props for shallow comparison between renders
- 11 unnecessary-rerender tests
- 8 panel integration tests
- `unnecessaryRerenderRatio` and `unnecessaryRerenderMinCount` thresholds

### Fixed
- Panel portal uses `useState` instead of `useRef` — portal now triggers re-render on mount
## [0.3.0] - 2026-03-05

Code audit and panel rewrite. Zero unsafe casts, full accessibility, strict type safety.

### Breaking

- `trackProps` removed from `UseRenderTrackerOptions` — was shipping broken results. Deferred to v0.3.x when prop capture is implemented.
- `ComponentPerfData.recentRenders` is now `RenderBuffer` instead of `RenderEvent[]` — consumers must use `.toArray()` to get an array. Snapshot API is unchanged.
- `SerializedComponentPerfData` added for snapshot consumers who need the flat array form.

### Fixed

- **Type safety:** `RenderBuffer` interface replaces 8 unsafe `as unknown as` casts. The type system no longer lies about the runtime shape of render data.
- **Hooks violation:** `useRenderTracker` had a conditional return before hooks. Guards moved inside each effect.
- **Portal leak:** panel portal element now created in `useEffect` with cleanup on unmount.
- **Silent failures:** all error catch blocks now warn in development, consistent `[perflens]` prefix.
- **Non-null assertions:** eliminated from provider — proper narrowing instead.
- **`usePerfLensStore`:** returns stable memoized reference, insights returned as copy.
- **`PerfLensTrack`:** `handleRender` wrapped in `useCallback` to prevent unnecessary Profiler bookkeeping.
- **`exactOptionalPropertyTypes`:** enabled in tsconfig — surfaced and fixed 3 real type bugs.
- **Coverage config:** stale exclusions removed, now only excludes actual stubs.

### Changed

- Panel rewritten and decomposed into 4 files: `PerfLensPanel.tsx`, `ComponentTable.tsx`, `InsightList.tsx`, `panel-utils.ts`
- Panel accessibility: ARIA `tablist`/`tab`/`tabpanel`, `role="dialog"`, focus management, `aria-label` on all buttons, `scope` on table headers, decorative elements hidden from screen readers
- `StatusDot` now reads thresholds from context instead of hardcoded magic numbers
- `ResolvedConfig.panelPosition` uses `PanelPosition` type instead of inline union
- Playground imports from published `react-perflens` npm package instead of local source aliases
- Vercel deploy config added for live playground

### Bundle size

- Core: 3.63 KB gzipped (down from 3.73 KB)
- Full (with panel): 8.26 KB gzipped

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
