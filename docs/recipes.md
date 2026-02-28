# Recipes

## Disable in Production

```tsx
<PerfLensProvider enabled={process.env.NODE_ENV === 'development'}>
  <App />
</PerfLensProvider>
```

## Track a Component (with timing)

```tsx
<PerfLensTrack name="ExpensiveChart">
  <ExpensiveChart data={data} />
</PerfLensTrack>
```

## Track a Component (hook, no timing)

```tsx
useRenderTracker('ExpensiveChart', { trackProps: true });
```

## Custom Thresholds

```tsx
useRenderTracker('LiveTicker', {
  warnAfterRenders: 200,
  slowThreshold: 4,
});
```

## Pipe Insights to Analytics

```tsx
<PerfLensProvider config={{
  onInsight: (insight) => analytics.track('perf_insight', insight),
}}>
```

## Export Data

```tsx
const { snapshot } = usePerfLensStore();
const data = snapshot();
```
