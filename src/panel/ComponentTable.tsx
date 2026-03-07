import type { ComponentPerfData, PerfLensThresholds } from '../types';
import { fmt } from './panel-utils';

interface ComponentTableProps {
  components: ComponentPerfData[];
  thresholds: PerfLensThresholds;
}

export function ComponentTable({ components, thresholds }: ComponentTableProps) {
  if (components.length === 0) {
    return (
      <p style={{ color: '#555', textAlign: 'center', padding: '24px 16px', margin: 0 }}>
        No components tracked yet.
      </p>
    );
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }} role="table">
      <thead>
        <tr>
          <th scope="col" style={thStyle}>
            Component
          </th>
          <th scope="col" style={{ ...thStyle, textAlign: 'right' }}>
            Renders
          </th>
          <th scope="col" style={{ ...thStyle, textAlign: 'right' }}>
            Avg
          </th>
          <th scope="col" style={{ ...thStyle, textAlign: 'right' }}>
            Max
          </th>
          <th scope="col" style={thStyle}>
            Status
          </th>
        </tr>
      </thead>
      <tbody>
        {components.map((c) => (
          <tr key={c.name} style={{ borderBottom: '1px solid #222' }}>
            <td style={tdStyle}>
              <span style={{ color: '#ccc', fontWeight: 500 }}>{c.name}</span>
              {!c.isMounted && (
                <span style={{ color: '#666', fontSize: 10, marginLeft: 4 }}>unmounted</span>
              )}
            </td>
            <td style={{ ...tdStyle, textAlign: 'right' }}>{c.renderCount}</td>
            <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(c.avgDuration)}</td>
            <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(c.maxDuration)}</td>
            <td style={tdStyle}>
              <StatusIndicator data={c} thresholds={thresholds} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── StatusIndicator ─────────────────────────────────────────────

interface StatusInfo {
  readonly color: string;
  readonly label: string;
}

const STATUS_SLOW: StatusInfo = { color: '#dc2626', label: 'slow' };
const STATUS_HOT: StatusInfo = { color: '#ca8a04', label: 'hot' };
const STATUS_OK: StatusInfo = { color: '#16a34a', label: 'ok' };

function StatusIndicator({
  data,
  thresholds,
}: {
  data: ComponentPerfData;
  thresholds: PerfLensThresholds;
}) {
  let status: StatusInfo = STATUS_OK;

  if (data.avgDuration > thresholds.slowRenderMs) {
    status = STATUS_SLOW;
  } else if (data.renderCount > thresholds.excessiveRenderCount * 2.5) {
    status = STATUS_HOT;
  }

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: status.color,
          display: 'inline-block',
        }}
        aria-hidden="true"
      />
      <span style={{ color: '#888', fontSize: 11 }}>{status.label}</span>
    </span>
  );
}

// ── Shared styles ───────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: '6px 14px',
  textAlign: 'left',
  color: '#555',
  fontSize: 10,
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

const tdStyle: React.CSSProperties = {
  padding: '5px 14px',
  textAlign: 'left',
};
