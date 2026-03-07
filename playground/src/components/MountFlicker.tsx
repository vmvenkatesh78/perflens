import { useState, useEffect } from 'react';

// Toggles a child's key every 200ms, forcing React to destroy and
// recreate the component on every toggle.
// Should trigger: rapid-mount-unmount
export function MountFlicker() {
  const [flip, setFlip] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setFlip((f) => !f), 200);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        border: '2px solid #db2777',
        borderRadius: 8,
        padding: 16,
        minWidth: 200,
      }}
    >
      <h3 style={{ margin: '0 0 8px', color: '#db2777' }}>Mount Flicker</h3>
      <FlickerChild key={flip ? 'a' : 'b'} label={flip ? 'Version A' : 'Version B'} />
      <p style={{ fontSize: 12, color: '#999' }}>
        Key changes every 200ms — full mount/unmount cycle each time
      </p>
    </div>
  );
}

function FlickerChild({ label }: { label: string }) {
  const [mounted] = useState(() => performance.now().toFixed(0));

  return (
    <div
      style={{
        background: '#fdf2f8',
        padding: 8,
        borderRadius: 4,
        fontSize: 13,
      }}
    >
      <div>{label}</div>
      <div style={{ fontSize: 11, color: '#999' }}>mounted at: {mounted}</div>
    </div>
  );
}
