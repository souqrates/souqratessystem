/**
 * SOUQRATES STAGE — design tokens
 * Single source of truth for colors, typography, and spacing.
 */
export const tokens = {
  brand: 'SOUQRATES STAGE',
  colors: {
    primary:   '#eab308',
    secondary: '#a855f7',
    bg:        '#07050f',
    surface:   'rgba(234,179,8,0.06)',
    accent:    '#fde047',
    muted:     'rgba(148,163,184,0.5)',
    text:      '#f1f5f9',
    border:    'rgba(234,179,8,0.15)',
    error:     '#f43f5e',
    success:   '#22c55e',
  },
  radii: {
    card:   '18px',
    button: '12px',
    badge:  '99px',
  },
  fonts: {
    display: '"Orbitron", sans-serif',
    body:    '"Tajawal", sans-serif',
  },
  shadows: {
    card: '0 8px 32px rgba(234,179,8,0.08)',
    glow: '0 0 24px rgba(234,179,8,0.25)',
  },
} as const;

export type Tokens = typeof tokens;
