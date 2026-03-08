# What is perflens?

A guide for anyone who wants to understand what perflens does, why it exists, and how it works. No prior experience with performance tooling is assumed.

## The Problem perflens Solves

When you build a React app, every component is a function that React calls to figure out what to show on screen. React calls these functions a lot — every time state changes, every time a parent re-renders, every time context updates. Most of the time this is fine. React is fast.

But sometimes a component renders too often, or takes too long, or gets destroyed and recreated when it should just update. When this happens, the app feels slow — scrolling is janky, buttons are unresponsive, animations stutter. The user notices, even if they can't articulate what's wrong.

The hard part is figuring out which component is causing the problem. React DevTools has a Profiler tab, but it requires you to manually start recording, reproduce the issue, stop recording, and then dig through a flame graph. If you don't know what you're looking for, you won't find it. Lighthouse tells you the page is slow but can't tell you which React component is responsible.

perflens sits in between. It watches your components in real-time, counts how often they render, measures how long each render takes, and flags patterns that indicate problems. When it finds something, it tells you what's wrong, why it matters, and how to fix it — in plain English.

## How It Works (No Code Yet)

Think of perflens as three systems working together:

**The tracker** watches your components render. Every time React renders a component that perflens is tracking, it records a data point: what rendered, when, how long it took, and whether it was a fresh mount or an update. This data goes into a store — a simple in-memory database that holds the last 100 render events per component.

**The analyzer** runs every 2 seconds. It looks at the data in the store and checks it against a set of rules. Each rule looks for a specific pattern. "Is this component's average render time over 16 milliseconds?" "Has this component rendered more than 20 times in the last 10 seconds?" "Is this component getting destroyed and recreated in a loop?" If a rule finds a problem, it creates an insight — a structured description of the issue with a severity level and a suggested fix.

**The panel** is a floating overlay that displays the tracker data and analyzer insights in your browser. It polls the store twice per second and updates a table of components (sorted by render count) and a list of insights (sorted by severity). You toggle it with Ctrl+Shift+P.

None of these systems interfere with each other. The tracker writes data but never triggers React re-renders. The analyzer reads data but never blocks the main thread during a render. The panel reads data on its own schedule. Your app runs at full speed while perflens observes from the side.

## What It Detects

perflens currently has four detection rules. Each one targets a specific class of performance problem.

### Slow Render

A component that takes too long to render. React aims for 60 frames per second, which means each frame has a budget of about 16 milliseconds. If a single component's render takes more than 16ms, it's eating the entire frame budget by itself. Other components don't get a chance to render, animations freeze, and the UI feels unresponsive.

perflens measures the actual time React spends rendering each tracked component. If the average is over 16ms, it flags it. If the average is over 32ms (double the budget), it flags it as critical.

Common causes: doing expensive calculations directly in the render function (sorting large arrays, complex math, deep object transformations), rendering huge DOM trees (tables with thousands of rows), or calling functions that block the thread (synchronous file reads, heavy regex operations).

### Excessive Re-renders

A component that renders too many times in a short period. If a component renders 40 times in 10 seconds and nothing visible changes, those 40 renders are wasted CPU time. The browser is busy doing work that produces no visible result.

perflens counts renders in a sliding time window. If a component exceeds the threshold (default 20 renders in 10 seconds), it flags it. At 2x the threshold, it becomes critical.

Common causes: a parent component passing new object or array references on every render (even if the values haven't changed), setState calls inside useEffect without proper dependencies (creating an update loop), context providers that update their value on every render (causing all consumers to re-render).

### Rapid Mount/Unmount

A component that gets destroyed and recreated in a loop. In React, when a component unmounts, all its state is destroyed, all its effects are cleaned up, and everything is re-initialized from scratch on the next mount. This is much more expensive than a simple re-render, and it's almost always a bug.

perflens counts how many times a component goes through the mount phase within a time window. If it mounts 5+ times in 5 seconds, something is causing React to destroy and recreate it instead of updating it.

Common causes: a `key` prop that changes on every render (React treats a new key as a completely new component), conditional rendering (`{show && <Component />}`) where `show` toggles rapidly.

### Wasted Memoization

A component wrapped in `React.memo` where the memoization isn't actually helping. `React.memo` tells React to skip rendering a component if its props haven't changed. But the comparison itself has a cost — React has to shallow-compare every prop on every parent render. If the component re-renders most of the time anyway (because its props keep changing), the comparison is just wasted overhead.

perflens compares two numbers from React's Profiler: `actualDuration` (how long the render actually took) and `baseDuration` (how long it would take without memoization). If the difference is less than 10%, memo isn't saving enough to justify its cost.

Common causes: passing inline objects (`style={{ color: 'red' }}`), inline arrow functions (`onClick={() => handleClick(id)}`), or values derived from state that changes on every render. Each of these creates a new reference on every parent render, defeating memo's prop comparison.

## How to Use It

### Step 1: Install

```bash
npm install react-perflens
```

### Step 2: Wrap Your App

```tsx
import { PerfLensProvider } from 'react-perflens';
import { PerfLensPanel } from 'react-perflens/panel';

function App() {
  return (
    <PerfLensProvider enabled={process.env.NODE_ENV === 'development'}>
      <YourApp />
      <PerfLensPanel />
    </PerfLensProvider>
  );
}
```

`PerfLensProvider` wraps your entire app with a React Profiler. This is what gives perflens access to render timing data. When `enabled` is `false` (e.g., in production), it renders your app with zero overhead — no Profiler, no store, no tracking.

`PerfLensPanel` is the floating overlay. It's imported from a separate path (`react-perflens/panel`) so the UI code doesn't inflate the bundle for consumers who don't need it.

### Step 3: Track Specific Components

You have two options.

**Option A: Wrapper component** — gives you render timing.

```tsx
import { PerfLensTrack } from 'react-perflens';

function Dashboard() {
  return (
    <PerfLensTrack name="UserList">
      <UserList />
    </PerfLensTrack>
  );
}
```

`PerfLensTrack` wraps a subtree with its own Profiler. React measures how long it takes to render everything inside and reports it via the `onRender` callback. This is how perflens gets `actualDuration` and `baseDuration` per component.

**Option B: Hook** — gives you render counting and mount/unmount tracking.

```tsx
import { useRenderTracker } from 'react-perflens';

function UserList({ users }) {
  useRenderTracker('UserList');
  return (
    <ul>
      {users.map((u) => (
        <li key={u.id}>{u.name}</li>
      ))}
    </ul>
  );
}
```

`useRenderTracker` is a hook you call inside the component. It counts every render and records mount/unmount events. It cannot measure timing — that's a React limitation. The Profiler API is a component, not a hook, so you need `PerfLensTrack` for timing data.

You can use both together on the same component to get the full picture.

### Step 4: Open the Panel

Press `Ctrl+Shift+P` (configurable). The panel opens in the bottom-right corner of your browser. You'll see two tabs:

**Components** — a table showing every tracked component, sorted by render count. Each row shows the component name, how many times it has rendered, the average render duration, the maximum duration, and a status indicator (ok, hot, or slow).

**Insights** — a list of detected issues, sorted by severity (critical first). Each insight has a title describing the problem, a description explaining why it matters, and a suggestion for how to fix it.

### Step 5: Fix the Problems

The insights tell you what to look at and what to try. For example:

- "UserList averages 24ms per render" → move expensive work into `useMemo`, split the component
- "Sidebar rendered 47 times in 10s" → check for unstable context, add `React.memo`, stabilize props
- "Modal mounted 8 times in 5s" → check the `key` prop, simplify conditional rendering

After making a change, watch the panel. If the insight disappears or drops from critical to warning, your fix worked. If it doesn't change, the root cause is somewhere else.

## What perflens Is Not

perflens is not a replacement for React DevTools. DevTools gives you the full Profiler with flame graphs, component tree inspection, and state/props debugging. perflens gives you automated detection and plain-language guidance.

perflens is not a production monitoring tool. It's designed for development — you wrap your app with it during development, find and fix issues, and disable it in production. The React Profiler has overhead that you don't want in production.

perflens is not a linter or static analysis tool. It doesn't read your source code. It observes your app at runtime and detects patterns in actual render behavior. A component that looks fine in code review might render 100 times per second due to a context update pattern that's only visible at runtime.

## Key Concepts

**Frame budget** — at 60fps, each frame has 16.67 milliseconds. Everything that needs to happen in a frame — JavaScript execution, layout, paint — needs to fit within that budget. A React component that takes 20ms to render has already exceeded the budget by itself. perflens uses 16ms as the default threshold for the slow-render rule.

**Render vs mount** — a mount is the first time React creates a component instance and adds it to the DOM. An update (re-render) is when React calls the component function again because something changed. Mounting is more expensive than updating because React has to create DOM nodes from scratch. Frequent mounting usually indicates a bug.

**Memoization** — `React.memo` wraps a component and tells React to skip rendering it if the props haven't changed. "Changed" means a different reference — `{a: 1} !== {a: 1}` because they're different objects in memory, even though the values are the same. This is why inline objects and functions defeat memoization.

**Circular buffer** — a fixed-size data structure that overwrites its oldest data when full. perflens uses this to store the last 100 render events per component. This keeps memory bounded — no matter how many times a component renders, it never uses more than a fixed amount of memory.

**Insight** — perflens's term for a detected performance issue. Each insight has a type (what rule detected it), a severity (info, warning, or critical), and actionable text (what happened, why it matters, what to do about it).

## Configuration

Every threshold is tunable:

```tsx
<PerfLensProvider config={{
  thresholds: {
    slowRenderMs: 8,            // tighter for high-refresh displays
    excessiveRenderCount: 50,   // more lenient for live dashboards
    excessiveRenderWindow: 5000,// shorter window
    memoSavingsThreshold: 20,   // memo must save 20%+ to be worth it
    rapidMountCycles: 3,        // flag flicker earlier
    rapidMountWindow: 3000,     // shorter window
  },
  analyzerInterval: 5000,       // sweep every 5s instead of 2s
  panelPosition: 'top-left',    // move the panel
  toggleKey: 'ctrl+shift+d',    // different keyboard shortcut
}}>
```

## Further Reading

- [Architecture](architecture.md) — how the three layers are structured
- [Decisions](decisions.md) — why every major design choice was made
- [Insights](insights.md) — detailed documentation for each detection rule
- [Recipes](recipes.md) — common patterns and configurations
- [API Reference](api-reference.md) — all exports and their types
- [Codebase Walkthrough](codebase-walkthrough.md) — file-by-file tour of the source code
