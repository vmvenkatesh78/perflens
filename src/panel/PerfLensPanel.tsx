import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePerfLensContext } from '../core/provider';
import { PANEL_POLL_INTERVAL } from '../constants';
import type { ComponentPerfData, Insight, InsightSeverity } from '../types';

/**
 * Floating performance overlay. Renders via portal so it sits on top
 * of the host app without affecting its layout.
 *
 * Toggle with Ctrl+Shift+P (configurable). Polls the store every 500ms
 * rather than subscribing to every mutation — keeps it cheap.
 */
export function PerfLensPanel() {
  const { store, config } = usePerfLensContext();
  const [visible, setVisible] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [components, setComponents] = useState<ComponentPerfData[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [totalRenders, setTotalRenders] = useState(0);
  const [activeTab, setActiveTab] = useState<'components' | 'insights'>('components');
  const portalRef = useRef<HTMLElement | null>(null);

  // lazy-create the portal container so we don't touch the DOM on import
  if (!portalRef.current && typeof document !== 'undefined') {
    portalRef.current = document.createElement('div');
    portalRef.current.id = 'perflens-panel-root';
    document.body.appendChild(portalRef.current);
  }

  // keyboard shortcut — parsed once from config string
  useEffect(() => {
    const keys = parseToggleKey(config.toggleKey);

    const handler = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === keys.key &&
        e.ctrlKey === keys.ctrl &&
        e.shiftKey === keys.shift &&
        e.altKey === keys.alt &&
        e.metaKey === keys.meta
      ) {
        e.preventDefault();
        setVisible((v) => !v);
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [config.toggleKey]);

  // poll the store on an interval — reads are cheap
  useEffect(() => {
    if (!visible) return;

    const tick = () => {
      const entries = Array.from(store.components.values())
        .sort((a, b) => b.renderCount - a.renderCount);
      setComponents(entries);
      setInsights([...store.insights]);
      setTotalRenders(store.totalRenders);
    };

    tick(); // immediate first read
    const id = setInterval(tick, PANEL_POLL_INTERVAL);
    return () => clearInterval(id);
  }, [visible, store]);

  const handleExport = useCallback(() => {
    const snap = store.snapshot();
    const blob = new Blob(
      [JSON.stringify(snap, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `perflens-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [store]);

  const handleClear = useCallback(() => {
    store.clear();
    setComponents([]);
    setInsights([]);
    setTotalRenders(0);
  }, [store]);

  if (!portalRef.current) return null;

  const position = positionStyle(config.panelPosition);

  // collapsed pill — just shows insight count as a badge
  if (!visible) {
    return createPortal(
      <button
        onClick={() => setVisible(true)}
        aria-label="Open perflens panel"
        style={{
          ...position,
          position: 'fixed',
          zIndex: 99999,
          background: '#1a1a2e',
          color: '#e8520e',
          border: '1px solid #333',
          borderRadius: 20,
          padding: '6px 14px',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
        }}
      >
        ⚡ perflens
        {insights.length > 0 && (
          <span style={{
            background: hasLevel(insights, 'critical') ? '#dc2626' : '#ca8a04',
            color: '#fff',
            borderRadius: 10,
            padding: '1px 7px',
            fontSize: 10,
            fontWeight: 700,
          }}>
            {insights.length}
          </span>
        )}
      </button>,
      portalRef.current,
    );
  }

  return createPortal(
    <div
      style={{
        ...position,
        position: 'fixed',
        zIndex: 99999,
        width: minimized ? 260 : 480,
        maxHeight: minimized ? 'auto' : '70vh',
        background: '#1a1a2e',
        color: '#e0e0e0',
        borderRadius: 10,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12,
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: '1px solid #2a2a3e',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#e8520e', fontWeight: 700, fontSize: 13 }}>
            ⚡ perflens
          </span>
          <span style={{ color: '#555', fontSize: 11 }}>
            {components.length} tracked · {totalRenders} renders
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <HeaderBtn label="↓" title="Export snapshot" onClick={handleExport} />
          <HeaderBtn label="∅" title="Clear data" onClick={handleClear} />
          <HeaderBtn
            label={minimized ? '□' : '–'}
            title={minimized ? 'Expand' : 'Minimize'}
            onClick={() => setMinimized((m) => !m)}
          />
          <HeaderBtn label="✕" title="Close panel" onClick={() => setVisible(false)} />
        </div>
      </div>

      {!minimized && (
        <>
          {/* tabs */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid #2a2a3e',
            flexShrink: 0,
          }}>
            <TabBtn
              label="Components"
              active={activeTab === 'components'}
              onClick={() => setActiveTab('components')}
            />
            <TabBtn
              label={`Insights${insights.length > 0 ? ` (${insights.length})` : ''}`}
              active={activeTab === 'insights'}
              onClick={() => setActiveTab('insights')}
              badge={insights.length > 0}
            />
          </div>

          {/* content */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
            {activeTab === 'components' ? (
              <ComponentTable components={components} />
            ) : (
              <InsightList insights={insights} />
            )}
          </div>
        </>
      )}
    </div>,
    portalRef.current,
  );
}

// ── Subcomponents ────────────────────────────────────────────────

function ComponentTable({ components }: { components: ComponentPerfData[] }) {
  if (components.length === 0) {
    return <Empty text="No components tracked yet." />;
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <TH>Component</TH>
          <TH align="right">Renders</TH>
          <TH align="right">Avg</TH>
          <TH align="right">Max</TH>
          <TH>Status</TH>
        </tr>
      </thead>
      <tbody>
        {components.map((c) => (
          <tr key={c.name} style={{ borderBottom: '1px solid #222' }}>
            <TD>
              <span style={{ color: '#ccc', fontWeight: 500 }}>{c.name}</span>
              {!c.isMounted && (
                <span style={{ color: '#666', fontSize: 10, marginLeft: 4 }}>
                  unmounted
                </span>
              )}
            </TD>
            <TD align="right">{c.renderCount}</TD>
            <TD align="right">{fmt(c.avgDuration)}</TD>
            <TD align="right">{fmt(c.maxDuration)}</TD>
            <TD>
              <StatusDot data={c} />
            </TD>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function InsightList({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return <Empty text="No issues detected. Nice work." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {insights.map((insight) => (
        <div
          key={insight.id}
          style={{
            padding: '8px 14px',
            borderBottom: '1px solid #222',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <SeverityBadge severity={insight.severity} />
            <span style={{ color: '#ccc', fontWeight: 500, fontSize: 12 }}>
              {insight.title}
            </span>
          </div>
          <p style={{ color: '#888', fontSize: 11, margin: '0 0 4px', lineHeight: 1.4 }}>
            {insight.description}
          </p>
          <p style={{ color: '#6b8aad', fontSize: 11, margin: 0, lineHeight: 1.4 }}>
            💡 {insight.suggestion}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Small pieces ─────────────────────────────────────────────────

function HeaderBtn({ label, title, onClick }: { label: string; title: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'transparent',
        border: '1px solid #333',
        color: '#888',
        borderRadius: 4,
        width: 24,
        height: 24,
        cursor: 'pointer',
        fontSize: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
      }}
    >
      {label}
    </button>
  );
}

function TabBtn({
  label, active, onClick, badge,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '8px 12px',
        background: active ? '#2a2a3e' : 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid #e8520e' : '2px solid transparent',
        color: active ? '#e0e0e0' : '#666',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
      {badge && !active && (
        <span style={{
          display: 'inline-block',
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: '#e8520e',
          marginLeft: 4,
          verticalAlign: 'middle',
        }} />
      )}
    </button>
  );
}

function StatusDot({ data }: { data: ComponentPerfData }) {
  let color = '#16a34a';
  let label = 'ok';

  if (data.avgDuration > 16) {
    color = '#dc2626';
    label = 'slow';
  } else if (data.renderCount > 50) {
    color = '#ca8a04';
    label = 'hot';
  }

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: color,
        display: 'inline-block',
      }} />
      <span style={{ color: '#888', fontSize: 11 }}>{label}</span>
    </span>
  );
}

function SeverityBadge({ severity }: { severity: InsightSeverity }) {
  const colors: Record<InsightSeverity, { bg: string; text: string }> = {
    critical: { bg: '#dc2626', text: '#fff' },
    warning: { bg: '#ca8a04', text: '#fff' },
    info: { bg: '#2563eb', text: '#fff' },
  };
  const c = colors[severity];

  return (
    <span style={{
      background: c.bg,
      color: c.text,
      borderRadius: 4,
      padding: '1px 6px',
      fontSize: 10,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    }}>
      {severity}
    </span>
  );
}

function TH({ children, align }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th style={{
      padding: '6px 14px',
      textAlign: align ?? 'left',
      color: '#555',
      fontSize: 10,
      fontWeight: 500,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    }}>
      {children}
    </th>
  );
}

function TD({ children, align }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td style={{ padding: '5px 14px', textAlign: align ?? 'left' }}>
      {children}
    </td>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p style={{ color: '#555', textAlign: 'center', padding: '24px 16px', margin: 0 }}>
      {text}
    </p>
  );
}

// ── Helpers ──────────────────────────────────────────────────────

/** Parse shortcut string like "ctrl+shift+p" into modifier flags + key. */
function parseToggleKey(raw: string) {
  const parts = raw.toLowerCase().split('+');
  return {
    ctrl: parts.includes('ctrl'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    meta: parts.includes('meta') || parts.includes('cmd'),
    key: parts.filter((p) => !['ctrl', 'shift', 'alt', 'meta', 'cmd'].includes(p))[0] ?? 'p',
  };
}

/** Map panel position config to CSS positioning. */
function positionStyle(position: string): React.CSSProperties {
  switch (position) {
    case 'top-left':
      return { top: 12, left: 12 };
    case 'top-right':
      return { top: 12, right: 12 };
    case 'bottom-left':
      return { bottom: 12, left: 12 };
    case 'bottom-right':
    default:
      return { bottom: 12, right: 12 };
  }
}

function hasLevel(insights: Insight[], level: InsightSeverity): boolean {
  return insights.some((i) => i.severity === level);
}

/** Format ms to 2 decimal places, drop trailing zeros. */
function fmt(ms: number): string {
  if (ms === 0) return '–';
  return ms.toFixed(2).replace(/\.?0+$/, '') + 'ms';
}
