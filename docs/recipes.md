# Recipes

Common patterns and configurations.

## Disable in Production

```tsx
<PerfLensProvider enabled={process.env.NODE_ENV === 'development'}>
  <App />
</PerfLensProvider>
```

When `enabled` is `false`, the provider renders children directly. No Profiler, no store, no overhead.

## Track a Component (with timing)

```tsx
<PerfLensTrack name="ExpensiveChart">
  <ExpensiveChart data={data} />
</PerfLensTrack>
```

Wraps the subtree with its own Profiler — gives you actual render durations.

## Track a Component (hook, no timing)

```tsx
useRenderTracker('ExpensiveChart', { trackProps: true });
```

Counts renders and tracks mount/unmount. No timing data (React limitation at the hook level). Use both `PerfLensTrack` + `useRenderTracker` if you want the full picture.

## Custom Thresholds

```tsx
<PerfLensProvider config={{
  thresholds: {
    slowRenderMs: 8,            // tighter for 120fps screens
    excessiveRenderCount: 50,   // lenient for live dashboards
    memoSavingsThreshold: 20,   // memo must save 20%+ to be worth it
  },
}}>
```

## Pipe Insights to Analytics

```tsx
<PerfLensProvider config={{
  onInsight: (insight) => {
    analytics.track('perf_issue', {
      type: insight.type,
      severity: insight.severity,
      component: insight.componentName,
    });
  },
}}>
```

The callback fires once per new insight. If the same component keeps triggering the same rule, you only get the callback on the first detection.

## Export a Snapshot

```tsx
const { snapshot } = usePerfLensStore();

function handleExport() {
  const data = snapshot();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'perflens-snapshot.json';
  a.click();
  URL.revokeObjectURL(url);
}
```

Snapshots are fully serializable — safe to `JSON.stringify`, `postMessage`, or send to a backend.

## Ignore Noisy Components

```tsx
// this component re-renders on purpose (animation, live ticker)
useRenderTracker('StockTicker', { ignore: true });
```

## Adjust the Analyzer Interval

```tsx
<PerfLensProvider config={{
  analyzerInterval: 5_000, // sweep every 5s instead of 2s
}}>
```

Lower = catches issues faster. Higher = less CPU overhead from the analyzer itself. Default 2s is a good balance for development.
