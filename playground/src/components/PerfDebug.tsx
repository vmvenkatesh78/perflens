import { useState, useEffect } from 'react';
import { usePerfLensStore } from 'perflens';
import type { ComponentPerfData } from 'perflens';

// Temporary debug panel. Polls the store every 500ms and displays
// tracked components. Gets replaced by <PerfLensPanel /> in v0.2.0.
export function PerfDebug() {
  const store = usePerfLensStore();
  const [data, setData] = useState<ComponentPerfData[]>([]);
  const [totalRenders, setTotalRenders] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      const entries = Array.from(store.components.values())
        .sort((a, b) => b.renderCount - a.renderCount);
      setData([...entries]);
      setTotalRenders(store.totalRenders);
    }, 500);
    return () => clearInterval(id);
  }, [store]);

  return (
    <div style={{
      background: '#1a1a2e',
      color: '#e0e0e0',
      borderRadius: 8,
      padding: 16,
      fontFamily: 'Consolas, monospace',
      fontSize: 13,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontWeight: 'bold', color: '#e8520e' }}>perflens debug</span>
        <span style={{ color: '#888' }}>
          {data.length} components · {totalRenders} total renders
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              const snap = store.snapshot();
              console.log('perflens snapshot:', snap);
              const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'perflens-snapshot.json';
              a.click();
              URL.revokeObjectURL(url);
            }}
            style={btnStyle}
          >
            export
          </button>
          <button onClick={() => store.clear()} style={btnStyle}>
            clear
          </button>
        </div>
      </div>

      {data.length === 0 ? (
        <p style={{ color: '#666' }}>No components tracked yet. Toggle a scenario above.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #333', textAlign: 'left' }}>
              <th style={thStyle}>Component</th>
              <th style={thStyle}>Renders</th>
              <th style={thStyle}>Avg (ms)</th>
              <th style={thStyle}>Max (ms)</th>
              <th style={thStyle}>Mounts</th>
              <th style={thStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.name} style={{ borderBottom: '1px solid #2a2a3e' }}>
                <td style={tdStyle}>{c.name}</td>
                <td style={tdStyle}>{c.renderCount}</td>
                <td style={tdStyle}>{c.avgDuration.toFixed(2)}</td>
                <td style={tdStyle}>{c.maxDuration.toFixed(2)}</td>
                <td style={tdStyle}>{c.mountCount}</td>
                <td style={tdStyle}>
                  <span style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: getStatusColor(c),
                    marginRight: 6,
                  }} />
                  {getStatusLabel(c)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function getStatusColor(c: ComponentPerfData): string {
  if (c.avgDuration > 16) return '#dc2626';
  if (c.renderCount > 50) return '#ca8a04';
  return '#16a34a';
}

function getStatusLabel(c: ComponentPerfData): string {
  if (c.avgDuration > 16) return 'slow';
  if (c.renderCount > 50) return 'hot';
  return 'ok';
}

const btnStyle: React.CSSProperties = {
  background: '#2a2a3e',
  color: '#ccc',
  border: '1px solid #444',
  borderRadius: 4,
  padding: '2px 10px',
  cursor: 'pointer',
  fontSize: 12,
};

const thStyle: React.CSSProperties = { padding: '6px 8px', color: '#888', fontSize: 11, fontWeight: 'normal' };
const tdStyle: React.CSSProperties = { padding: '6px 8px' };
