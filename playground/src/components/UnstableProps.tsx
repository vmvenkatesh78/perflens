import { useState, useEffect } from 'react';

// Parent re-renders on interval and passes a new object reference every time.
// Child receives identical *values* but different *references*.
// Should trigger: unnecessary-rerender (once prop tracking is wired)
export function UnstableProps() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  // new object every render — same values, different reference
  const config = { theme: 'dark', locale: 'en' };
  const items = ['a', 'b', 'c'];

  return (
    <div
      style={{
        border: '2px solid #7c3aed',
        borderRadius: 8,
        padding: 16,
        minWidth: 200,
      }}
    >
      <h3 style={{ margin: '0 0 8px', color: '#7c3aed' }}>Unstable Props</h3>
      <p>Parent tick: {tick}</p>
      <ChildDisplay config={config} items={items} />
      <p style={{ fontSize: 12, color: '#999' }}>New object/array refs on every parent render</p>
    </div>
  );
}

// no React.memo — re-renders even though props haven't meaningfully changed
function ChildDisplay({
  config,
  items,
}: {
  config: { theme: string; locale: string };
  items: string[];
}) {
  return (
    <div style={{ background: '#f5f3ff', padding: 8, borderRadius: 4, fontSize: 13 }}>
      <div>theme: {config.theme}</div>
      <div>items: {items.join(', ')}</div>
    </div>
  );
}
