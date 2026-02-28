# Insights

Ships in v0.3.0.

## Excessive Re-renders

Triggers: > 20 renders in 10s. Fix: stabilize parent props, use `React.memo()`.

## Slow Render

Triggers: avg duration > 16ms. Fix: split component, defer with `useMemo()`.

## Unnecessary Re-render

Triggers: re-render with unchanged props (needs `trackProps: true`). Fix: `React.memo()`.

## Render Cascade

Triggers: 5+ components in one commit. Fix: split context, move state down.

## Wasted Memoization

Triggers: memo saves < 10%. Fix: remove the memo.

## Rapid Mount/Unmount

Triggers: 5+ mount/unmount cycles in 5s. Fix: check key props, conditional rendering.
