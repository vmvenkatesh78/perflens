# API Reference

Quick reference for all public exports. See [README](../README.md) for setup, [recipes](recipes.md) for patterns, [insights](insights.md) for what each rule detects, [guide](guide.md) for a beginner-friendly introduction.

## Exports

| Export             | Type      | Entry Point            | Since  |
| ------------------ | --------- | ---------------------- | ------ |
| `PerfLensProvider` | Component | `react-perflens`       | v0.1.0 |
| `PerfLensTrack`    | Component | `react-perflens`       | v0.1.0 |
| `useRenderTracker` | Hook      | `react-perflens`       | v0.1.0 |
| `usePerfLensStore` | Hook      | `react-perflens`       | v0.1.0 |
| `PerfLensPanel`    | Component | `react-perflens/panel` | v0.2.0 |

## Types

All types are exported from the main entry point:

```ts
import type {
  PerfLensConfig,
  PerfLensThresholds,
  ComponentPerfData,
  RenderEvent,
  RenderBuffer,
  Insight,
  InsightType,
  InsightSeverity,
  PerfLensStore,
  PerfLensSnapshot,
  SerializedComponentPerfData,
  UseRenderTrackerOptions,
} from 'react-perflens';
```

## Insight Types

| Type                   | Implemented | Rule                                   |
| ---------------------- | ----------- | -------------------------------------- |
| `slow-render`          | v0.2.0      | Avg render > 16ms                      |
| `excessive-rerenders`  | v0.2.0      | 20+ renders in 10s                     |
| `rapid-mount-unmount`  | v0.2.0      | 5+ mount cycles in 5s                  |
| `wasted-memo`          | v0.2.0      | Memo saves < 10%                       |
| `unnecessary-rerender` | Stub        | Needs prop capture (planned)           |
| `render-cascade`       | Stub        | Needs cross-component timing (planned) |

## Breaking Changes in v0.3.0

- `trackProps` removed from `UseRenderTrackerOptions` — was returning incorrect results. See [ADR-009](decisions.md#adr-009-no-trackprops-in-v02x-v030).
- `ComponentPerfData.recentRenders` changed from `RenderEvent[]` to `RenderBuffer`. Use `.toArray()` to get an array. See [ADR-007](decisions.md#adr-007-renderbuffer-interface-over-type-assertion).
- `SerializedComponentPerfData` added — used in `PerfLensSnapshot.components`. Has `recentRenders: RenderEvent[]` (the flattened form).
