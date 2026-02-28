# perflens

React performance toolkit. Track renders, surface insights, fix bottlenecks.

> **Status:** Pre-release. Core hooks and store are functional. Panel and insights in upcoming versions.

## Install

```bash
npm install perflens
```

## Quick Start

```tsx
import { PerfLensProvider, PerfLensTrack, useRenderTracker } from 'perflens';

function App() {
  return (
    <PerfLensProvider enabled={process.env.NODE_ENV === 'development'}>
      <YourApp />
    </PerfLensProvider>
  );
}

// option 1: wrapper — gives you render timing via Profiler
function Dashboard() {
  return (
    <PerfLensTrack name="UserList">
      <UserList />
    </PerfLensTrack>
  );
}

// option 2: hook — gives you render count + mount/unmount tracking
function UserList({ users }) {
  useRenderTracker('UserList');
  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

`PerfLensTrack` wraps a subtree with its own Profiler — you get actual render durations. `useRenderTracker` is a hook — counts renders and tracks mount/unmount but can't measure timing (React limitation). Use both if you want the full picture.

## What It Does

Sits between React DevTools and Lighthouse. Neither can tell you which component is causing your LCP to spike or why your sidebar re-renders 40 times a second.

perflens tracks render count and duration per component, unnecessary re-renders, render cascades, memoization effectiveness, and mount/unmount churn. Each issue comes with a plain-language explanation and a fix.

## API

### `<PerfLensProvider>`

| Prop | Type | Default |
|------|------|---------|
| `enabled` | `boolean` | `true` |
| `config` | `PerfLensConfig` | — |

When `enabled` is `false`, renders children with zero overhead.

### `<PerfLensTrack name="...">`

Wraps a subtree with its own React Profiler. This is how you get per-component timing data.

### `useRenderTracker(name, options?)`

Hook for render counting and mount/unmount tracking. No timing data (React Profiler is a component, not a hook).

| Option | Type | Default |
|--------|------|---------|
| `trackProps` | `boolean` | `false` |
| `warnAfterRenders` | `number` | `20` |
| `slowThreshold` | `number` | `16` |
| `ignore` | `boolean` | `false` |

### `usePerfLensStore()`

Returns the store directly. Build custom UIs or pipe data externally.

### `<PerfLensPanel />`

Floating overlay. Toggle with `Ctrl+Shift+P`. Ships in v0.2.0.

## Constraints

- Zero runtime dependencies
- < 1ms tracking overhead per component per render
- Never crashes your app
- Tree-shakeable
- React 18+

## Development

```bash
git clone https://github.com/vmvenkatesh78/perflens.git
cd perflens
npm install
npm test
npm run build
```

## License

MIT
