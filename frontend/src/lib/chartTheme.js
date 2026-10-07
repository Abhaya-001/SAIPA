/** Shared Recharts / visualization theme for SAIPA */

export const CHART_COLORS = [
  '#22d3ee', // cyan core
  '#10b981', // emerald
  '#f59e0b', // amber
  '#6366f1', // indigo (restrained)
  '#ec4899', // rose accent
  '#06b6d4', // teal
  '#84cc16', // lime
  '#f43f5e', // red accent
];

export const CHART_GRID = {
  stroke: 'rgba(148, 163, 184, 0.12)',
  strokeDasharray: '3 3',
};

export const CHART_AXIS = {
  stroke: 'rgba(148, 163, 184, 0.35)',
  tick: { fill: 'rgba(148, 163, 184, 0.7)', fontSize: 11 },
};

export function getTooltipStyle(isDark) {
  return {
    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)',
    border: isDark ? '1px solid rgba(34, 211, 238, 0.15)' : '1px solid rgba(226, 232, 240, 0.8)',
    borderRadius: '12px',
    boxShadow: isDark
      ? '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(34, 211, 238, 0.08)'
      : '0 8px 24px rgba(0, 0, 0, 0.08)',
    padding: '12px 16px',
  };
}

export function useIsDark() {
  if (typeof document === 'undefined') return true;
  return document.documentElement.classList.contains('dark');
}
