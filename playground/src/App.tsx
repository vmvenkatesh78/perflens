import { useState } from 'react';
import { PerfLensProvider, PerfLensTrack } from 'perflens';
import { PerfLensPanel } from 'perflens/panel';
import { RenderSpammer } from './components/RenderSpammer';
import { SlowComponent } from './components/SlowComponent';
import { UnstableProps } from './components/UnstableProps';
import { CascadeParent } from './components/CascadeParent';
import { MountFlicker } from './components/MountFlicker';
import { MemoWaste } from './components/MemoWaste';

const SCENARIOS = [
  { id: 'spammer', label: 'Render Spammer', insight: 'excessive-rerenders' },
  { id: 'slow', label: 'Slow Component', insight: 'slow-render' },
  { id: 'unstable', label: 'Unstable Props', insight: 'unnecessary-rerender' },
  { id: 'cascade', label: 'Cascade Parent', insight: 'render-cascade' },
  { id: 'flicker', label: 'Mount Flicker', insight: 'rapid-mount-unmount' },
  { id: 'memo', label: 'Memo Waste', insight: 'wasted-memo' },
] as const;

export function App() {
  const [active, setActive] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <PerfLensProvider>
      <div style={{ fontFamily: 'system-ui', maxWidth: 900, margin: '0 auto', padding: 24 }}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>perflens playground</h1>
        <p style={{ color: '#666', marginBottom: 24 }}>
          Each button activates a component with a specific perf anti-pattern.
          Use the debug panel below to see what perflens is tracking.
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => toggle(s.id)}
              style={{
                padding: '8px 16px',
                border: '1px solid #ccc',
                borderRadius: 6,
                background: active.has(s.id) ? '#e8520e' : '#fff',
                color: active.has(s.id) ? '#fff' : '#333',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              {s.label}
              <span style={{ display: 'block', fontSize: 11, opacity: 0.7 }}>
                {s.insight}
              </span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
          {active.has('spammer') && (
            <PerfLensTrack name="RenderSpammer">
              <RenderSpammer />
            </PerfLensTrack>
          )}
          {active.has('slow') && (
            <PerfLensTrack name="SlowComponent">
              <SlowComponent />
            </PerfLensTrack>
          )}
          {active.has('unstable') && (
            <PerfLensTrack name="UnstableProps">
              <UnstableProps />
            </PerfLensTrack>
          )}
          {active.has('cascade') && (
            <PerfLensTrack name="CascadeParent">
              <CascadeParent />
            </PerfLensTrack>
          )}
          {active.has('flicker') && (
            <PerfLensTrack name="MountFlicker">
              <MountFlicker />
            </PerfLensTrack>
          )}
          {active.has('memo') && (
            <PerfLensTrack name="MemoWaste">
              <MemoWaste />
            </PerfLensTrack>
          )}
        </div>

        <PerfLensPanel />
      </div>
    </PerfLensProvider>
  );
}
