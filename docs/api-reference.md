# API Reference

Quick reference for all public exports. See [README](../README.md) for setup, [recipes](recipes.md) for patterns, [insights](insights.md) for what each rule detects.

## Exports

| Export             | Type      | Since         |
| ------------------ | --------- | ------------- |
| `PerfLensProvider` | Component | v0.1.0        |
| `PerfLensTrack`    | Component | v0.1.0        |
| `useRenderTracker` | Hook      | v0.1.0        |
| `usePerfLensStore` | Hook      | v0.1.0        |
| `PerfLensPanel`    | Component | v0.2.0 (stub) |

## Types

All types are exported from the main entry point:

```ts
import type {
  PerfLensConfig,
  PerfLensThresholds,
  ComponentPerfData,
  RenderEvent,
  Insight,
  InsightType,
  InsightSeverity,
  PerfLensStore,
  PerfLensSnapshot,
  UseRenderTrackerOptions,
} from 'react-perflens';
```

## Insight Types

| Type                   | Implemented | Rule                                  |
| ---------------------- | ----------- | ------------------------------------- |
| `slow-render`          | ✅          | Avg render > 16ms                     |
| `excessive-rerenders`  | ✅          | 20+ renders in 10s                    |
| `rapid-mount-unmount`  | ✅          | 5+ mount cycles in 5s                 |
| `wasted-memo`          | ✅          | Memo saves < 10%                      |
| `unnecessary-rerender` | —           | Needs prop capture (v0.3.0)           |
| `render-cascade`       | —           | Needs cross-component timing (v0.3.0) |
