import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePerfLensContext } from '../core/provider';
import { PANEL_POLL_INTERVAL } from '../constants';
import type { ComponentPerfData, Insight } from '../types';
import { ComponentTable } from './ComponentTable';
import { InsightList } from './InsightList';
import { parseToggleKey, positionStyle, hasLevel } from './panel-utils';

type TabId = 'components' | 'insights';

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
  const [activeTab, setActiveTab] = useState<TabId>('components');
  const portalRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // C6: create and clean up portal container in an effect
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const container = document.createElement('div');
    container.id = 'perflens-panel-root';
    document.body.appendChild(container);
    portalRef.current = container;

    return () => {
      portalRef.current = null;
      document.body.removeChild(container);
    };
  }, []);

  // keyboard shortcut
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

  // focus management — save focus on open, restore on close
  useEffect(() => {
    if (visible) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      // defer focus so the portal has time to render
      requestAnimationFrame(() => {
        panelRef.current?.focus();
      });
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [visible]);

  // poll the store on an interval
  useEffect(() => {
    if (!visible) return;

    const tick = () => {
      const entries = Array.from(store.components.values()).sort(
        (a, b) => b.renderCount - a.renderCount,
      );
      setComponents(entries);
      setInsights([...store.insights]);
      setTotalRenders(store.totalRenders);
    };

    tick();
    const id = setInterval(tick, PANEL_POLL_INTERVAL);
    return () => clearInterval(id);
  }, [visible, store]);

  const handleExport = useCallback(() => {
    const snap = store.snapshot();
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
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

  // keyboard nav for tabs — arrow keys switch, enter/space activate
  const handleTabKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      setActiveTab((current) => (current === 'components' ? 'insights' : 'components'));
    }
  }, []);

  if (!portalRef.current) return null;

  const position = positionStyle(config.panelPosition);

  // collapsed pill — just shows insight count as a badge
  if (!visible) {
    return createPortal(
      <button
        onClick={() => setVisible(true)}
        aria-label={`Open perflens panel${insights.length > 0 ? `, ${insights.length} insights detected` : ''}`}
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
        <span aria-hidden="true">&#x26A1;</span> perflens
        {insights.length > 0 && (
          <span
            style={{
              background: hasLevel(insights, 'critical') ? '#dc2626' : '#ca8a04',
              color: '#fff',
              borderRadius: 10,
              padding: '1px 7px',
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            {insights.length}
          </span>
        )}
      </button>,
      portalRef.current,
    );
  }

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="perflens performance panel"
      tabIndex={-1}
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
        outline: 'none',
      }}
    >
      {/* header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid #2a2a3e',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#e8520e', fontWeight: 700, fontSize: 13 }} aria-hidden="true">
            &#x26A1;
          </span>
          <span style={{ color: '#e8520e', fontWeight: 700, fontSize: 13 }}>perflens</span>
          <span style={{ color: '#555', fontSize: 11 }} aria-live="polite">
            {components.length} tracked, {totalRenders} renders
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <HeaderBtn label="&#x2193;" ariaLabel="Export snapshot" onClick={handleExport} />
          <HeaderBtn label="&#x2205;" ariaLabel="Clear data" onClick={handleClear} />
          <HeaderBtn
            label={minimized ? '\u25A1' : '\u2013'}
            ariaLabel={minimized ? 'Expand panel' : 'Minimize panel'}
            onClick={() => setMinimized((m) => !m)}
          />
          <HeaderBtn label="\u2715" ariaLabel="Close panel" onClick={() => setVisible(false)} />
        </div>
      </div>

      {!minimized && (
        <>
          {/* tab bar */}
          <div
            role="tablist"
            aria-label="Panel views"
            style={{
              display: 'flex',
              borderBottom: '1px solid #2a2a3e',
              flexShrink: 0,
            }}
            onKeyDown={handleTabKeyDown}
          >
            <Tab
              id="tab-components"
              controls="tabpanel-components"
              label="Components"
              active={activeTab === 'components'}
              onClick={() => setActiveTab('components')}
            />
            <Tab
              id="tab-insights"
              controls="tabpanel-insights"
              label={`Insights${insights.length > 0 ? ` (${insights.length})` : ''}`}
              active={activeTab === 'insights'}
              onClick={() => setActiveTab('insights')}
              badge={insights.length > 0 && activeTab !== 'insights'}
            />
          </div>

          {/* tab panels */}
          <div
            id="tabpanel-components"
            role="tabpanel"
            aria-labelledby="tab-components"
            hidden={activeTab !== 'components'}
            style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}
          >
            <ComponentTable components={components} thresholds={config.thresholds} />
          </div>
          <div
            id="tabpanel-insights"
            role="tabpanel"
            aria-labelledby="tab-insights"
            hidden={activeTab !== 'insights'}
            style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}
          >
            <InsightList insights={insights} />
          </div>
        </>
      )}
    </div>,
    portalRef.current,
  );
}

// ── Subcomponents ────────────────────────────────────────────────

function HeaderBtn({
  label,
  ariaLabel,
  onClick,
}: {
  label: string;
  ariaLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
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
      <span aria-hidden="true">{label}</span>
    </button>
  );
}

function Tab({
  id,
  controls,
  label,
  active,
  onClick,
  badge,
}: {
  id: string;
  controls: string;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: boolean;
}) {
  return (
    <button
      id={id}
      role="tab"
      aria-selected={active}
      aria-controls={controls}
      tabIndex={active ? 0 : -1}
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
      {badge && (
        <span
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#e8520e',
            marginLeft: 4,
            verticalAlign: 'middle',
          }}
          aria-hidden="true"
        />
      )}
    </button>
  );
}
