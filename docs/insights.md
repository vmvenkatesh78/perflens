# Insights

perflens watches your components and flags performance problems it recognizes. Each insight includes what it found, why it matters, and what to do about it.

The analyzer runs on a 2-second interval (configurable via `analyzerInterval`). It never runs during renders — it reads from the store after the fact.

## Slow Render

**What:** A component's average render time exceeds the frame budget (16ms at 60fps).

**Why it matters:** Every frame over budget is a dropped frame. Users see jank — laggy scrolling, unresponsive buttons, stuttering animations.

**Severity:** Warning if over threshold. Critical if 2x+ over (32ms+ at default).

**Common causes:** Expensive calculations in the render path, large DOM output, unguarded loops, or inline sorting/filtering on every render.

**Fix:** Move heavy work into `useMemo`. Split the component so the expensive part doesn't block cheap UI updates. React DevTools Profiler can pinpoint exactly where the time goes.

## Excessive Re-renders

**What:** A component re-renders more than 20 times in 10 seconds (both configurable).

**Why it matters:** Most of those renders probably aren't producing visible changes. Each one still costs CPU time and can cause layout thrashing.

**Severity:** Warning at threshold. Critical at 2x (40+ renders in window).

**Common causes:** `setState` inside `useEffect` without proper deps, context providers that update on every render, event handlers that aren't debounced or throttled.

**Fix:** For high-frequency updates (>10/sec): check for `setState` in effects and unstabilized context. For moderate rates: `React.memo` can help if the output doesn't actually change. For context-heavy apps, splitting a single context into smaller ones prevents unrelated consumers from re-rendering.

## Rapid Mount/Unmount

**What:** A component gets destroyed and recreated 5+ times in 5 seconds (configurable).

**Why it matters:** Each mount/unmount cycle throws away all component state, runs every cleanup effect, and re-initializes from scratch. It's expensive, and it almost always means something is wrong.

**Severity:** Warning at threshold. Critical at 2x.

**Common causes:** Dynamic `key` props that change on every render (forces React to treat it as a new component), conditional rendering that flips too fast based on state in a loop or timer.

**Fix:** Check `key` props first — if the key changes, React destroys and recreates instead of updating. Then look at conditional rendering patterns (`{show && <Component />}`) where `show` toggles rapidly.

## Wasted Memoization

**What:** A component wrapped in `React.memo` (or using `useMemo`) saves less than 10% of render time.

**Why it matters:** `React.memo` isn't free — it shallow-compares every prop on every parent render. If the component re-renders almost every time anyway (because its props keep changing), the comparison is just overhead.

**Severity:** Warning for non-trivial components. Info for trivial ones (<1ms render time — the comparison likely costs more than the render).

**Common causes:** Passing new object/array literals as props, inline arrow functions, or values derived from state that changes on every render.

**Fix:** Either stabilize the props (`useMemo` for objects, `useCallback` for functions) so memo can actually skip renders, or just remove the memo wrapper.

## Not Yet Implemented

These rules are planned for v0.3.0:

**Unnecessary Re-render** — Detects re-renders where props haven't meaningfully changed. Needs the prop capture system to be finished first (currently stubbed).

**Render Cascade** — Detects when one state change triggers 5+ components to re-render in the same commit. The hardest rule to get right — needs to correlate timing across multiple components.

## Custom Thresholds

Every threshold is configurable:

```tsx
<PerfLensProvider config={{
  thresholds: {
    slowRenderMs: 8,              // tighter budget for animations
    excessiveRenderCount: 50,     // more lenient for live dashboards
    excessiveRenderWindow: 5_000, // shorter window
    memoSavingsThreshold: 20,     // stricter — memo must save 20%+
    rapidMountCycles: 3,          // flag flicker earlier
    rapidMountWindow: 3_000,
  },
}}>
```

## Programmatic Access

Hook into insights without the panel:

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

Or read them directly:

```tsx
const { insights } = usePerfLensStore();
```
