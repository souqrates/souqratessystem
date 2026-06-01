/**
 * SOUQRATES SOUQ — design tokens
 * Single source of truth for colors, typography, and spacing.
 * Use these values instead of hardcoding magic strings in components.
 */
export const tokens = {
  brand: 'SOUQRATES SOUQ',
  colors: {
    primary:   '#22d3ee',
    secondary: '#a855f7',
    bg:        '#040b0e',
    surface:   'rgba(34,211,238,0.06)',
    accent:    '#67e8f9',
    muted:     'rgba(148,163,184,0.5)',
    text:      '#f1f5f9',
    border:    'rgba(34,211,238,0.15)',
    error:     '#f43f5e',
    success:   '#22c55e',
  },
  radii: {
    card:   '16px',
    button: '12px',
    badge:  '99px',
    input:  '12px',
  },
  fonts: {
    display: '"Orbitron", sans-serif',
    body:    '"Tajawal", sans-serif',
  },
  shadows: {
    card: '0 8px 32px rgba(34,211,238,0.08)',
    glow: '0 0 24px rgba(34,211,238,0.25)',
  },
} as const;

export type Tokens = typeof tokens;
