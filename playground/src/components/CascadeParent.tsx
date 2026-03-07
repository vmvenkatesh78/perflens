import { createContext, useContext, useState, useEffect } from 'react';

const CascadeContext = createContext(0);

// Context updates every 300ms. 12 children consume it.
// One state change → 12 re-renders in the same commit.
// Should trigger: render-cascade
export function CascadeParent() {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setValue((v) => v + 1), 300);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        border: '2px solid #2563eb',
        borderRadius: 8,
        padding: 16,
        minWidth: 200,
      }}
    >
      <h3 style={{ margin: '0 0 8px', color: '#2563eb' }}>Cascade Parent</h3>
      <p>Context value: {value}</p>
      <CascadeContext.Provider value={value}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
          {Array.from({ length: 12 }, (_, i) => (
            <CascadeChild key={i} index={i} />
          ))}
        </div>
      </CascadeContext.Provider>
      <p style={{ fontSize: 12, color: '#999' }}>12 children re-render on every context change</p>
    </div>
  );
}

function CascadeChild({ index }: { index: number }) {
  const value = useContext(CascadeContext);
  return (
    <div
      style={{
        background: '#eff6ff',
        padding: '4px 8px',
        borderRadius: 4,
        fontSize: 12,
        textAlign: 'center',
      }}
    >
      #{index}: {value}
    </div>
  );
}
