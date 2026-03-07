import { useState, useEffect } from 'react';

// Re-renders ~50 times/sec via a fast interval.
// Should trigger: excessive-rerenders
export function RenderSpammer() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setCount((c) => c + 1), 20);
    return () => clearInterval(id);
  }, []);

  return (
    <Card title="Render Spammer" color="#dc2626">
      <p>Renders: {count}</p>
      <p style={{ fontSize: 12, color: '#999' }}>setInterval at 20ms — ~50 renders/sec</p>
    </Card>
  );
}

function Card({
  title,
  color,
  children,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: `2px solid ${color}`,
        borderRadius: 8,
        padding: 16,
        minWidth: 200,
      }}
    >
      <h3 style={{ margin: '0 0 8px', color }}>{title}</h3>
      {children}
    </div>
  );
}
