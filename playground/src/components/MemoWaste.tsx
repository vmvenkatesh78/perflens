import { memo, useState, useEffect } from 'react';

// React.memo wrapping a component that renders in <0.1ms.
// The prop comparison costs more than just re-rendering.
// Should trigger: wasted-memo
export function MemoWaste() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setCount((c) => c + 1), 400);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        border: '2px solid #16a34a',
        borderRadius: 8,
        padding: 16,
        minWidth: 200,
      }}
    >
      <h3 style={{ margin: '0 0 8px', color: '#16a34a' }}>Memo Waste</h3>
      <p>Parent renders: {count}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <MemoizedLabel text="Static label A" />
        <MemoizedLabel text="Static label B" />
        <MemoizedLabel text="Static label C" />
        <MemoizedLabel text="Static label D" />
        <MemoizedLabel text="Static label E" />
      </div>
      <p style={{ fontSize: 12, color: '#999' }}>React.memo on trivial components — savings ≈ 0%</p>
    </div>
  );
}

// this component costs basically nothing to render
// memo overhead (prop comparison) exceeds render cost
const MemoizedLabel = memo(function MemoizedLabel({ text }: { text: string }) {
  return (
    <span
      style={{
        background: '#f0fdf4',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 13,
      }}
    >
      {text}
    </span>
  );
});
