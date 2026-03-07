import type { Insight, InsightSeverity, PanelPosition } from '../types';

/** Parse shortcut string like "ctrl+shift+p" into modifier flags + key. */
export function parseToggleKey(raw: string): {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  key: string;
} {
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
export function positionStyle(position: PanelPosition): React.CSSProperties {
  switch (position) {
    case 'top-left':
      return { top: 12, left: 12 };
    case 'top-right':
      return { top: 12, right: 12 };
    case 'bottom-left':
      return { bottom: 12, left: 12 };
    case 'bottom-right':
      return { bottom: 12, right: 12 };
  }
}

/** Format ms to 2 decimal places, drop trailing zeros. */
export function fmt(ms: number): string {
  if (ms === 0) return '\u2013'; // en-dash
  return ms.toFixed(2).replace(/\.?0+$/, '') + 'ms';
}

export function hasLevel(insights: Insight[], level: InsightSeverity): boolean {
  return insights.some((i) => i.severity === level);
}

export const SEVERITY_COLORS: Record<InsightSeverity, { bg: string; text: string }> = {
  critical: { bg: '#dc2626', text: '#fff' },
  warning: { bg: '#ca8a04', text: '#fff' },
  info: { bg: '#2563eb', text: '#fff' },
};
