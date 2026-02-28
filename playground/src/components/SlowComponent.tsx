import { useState } from 'react';

// Burns ~30ms on every render with a blocking loop.
// Should trigger: slow-render
export function SlowComponent() {
  const [count, setCount] = useState(0);

  // deliberately wasteful — blocks the main thread
  const start = performance.now();
  while (performance.now() - start < 30) {
    // spin
  }

  return (
    <div
      style={{
        border: '2px solid #ca8a04',
        borderRadius: 8,
        padding: 16,
        minWidth: 200,
      }}
    >
      <h3 style={{ margin: '0 0 8px', color: '#ca8a04' }}>Slow Component</h3>
      <p>Renders: {count}</p>
      <button onClick={() => setCount((c) => c + 1)}>re-render (30ms block)</button>
      <p style={{ fontSize: 12, color: '#999' }}>
        Busy-waits 30ms in render — blows the 16ms frame budget
      </p>
    </div>
  );
}
