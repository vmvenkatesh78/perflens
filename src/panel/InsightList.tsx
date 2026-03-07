import type { Insight, InsightSeverity } from '../types';
import { SEVERITY_COLORS } from './panel-utils';

interface InsightListProps {
  insights: Insight[];
}

export function InsightList({ insights }: InsightListProps) {
  if (insights.length === 0) {
    return (
      <p style={{ color: '#555', textAlign: 'center', padding: '24px 16px', margin: 0 }}>
        No issues detected.
      </p>
    );
  }

  return (
    <ul
      style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}
      role="list"
      aria-label="Performance insights"
    >
      {insights.map((insight) => (
        <li
          key={insight.id}
          style={{
            padding: '8px 14px',
            borderBottom: '1px solid #222',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <SeverityBadge severity={insight.severity} />
            <span style={{ color: '#ccc', fontWeight: 500, fontSize: 12 }}>{insight.title}</span>
          </div>
          <p style={{ color: '#888', fontSize: 11, margin: '0 0 4px', lineHeight: 1.4 }}>
            {insight.description}
          </p>
          <p style={{ color: '#6b8aad', fontSize: 11, margin: 0, lineHeight: 1.4 }}>
            Suggestion: {insight.suggestion}
          </p>
        </li>
      ))}
    </ul>
  );
}

function SeverityBadge({ severity }: { severity: InsightSeverity }) {
  const colors = SEVERITY_COLORS[severity];

  return (
    <span
      style={{
        background: colors.bg,
        color: colors.text,
        borderRadius: 4,
        padding: '1px 6px',
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}
      role="status"
      aria-label={`${severity} severity`}
    >
      {severity}
    </span>
  );
}
