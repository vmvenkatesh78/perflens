import type { InsightSeverity } from '../types';

export function insightId(type: string, componentName: string): string {
  return `${type}::${componentName}`;
}

/** Sort comparator: critical > warning > info. */
export function bySeverity(a: { severity: InsightSeverity }, b: { severity: InsightSeverity }): number {
  const order: Record<InsightSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return order[a.severity] - order[b.severity];
}
