/**
 * SOUQRATES SUB-AGENTS — design tokens
 * Single source of truth for colors, typography, and spacing.
 */
export const tokens = {
  brand: 'SOUQRATES SUB-AGENTS',
  colors: {
    primary:   '#6366f1',
    secondary: '#f97316',
    bg:        '#05040f',
    surface:   'rgba(99,102,241,0.06)',
    accent:    '#818cf8',
    muted:     'rgba(148,163,184,0.5)',
    text:      '#f1f5f9',
    border:    'rgba(99,102,241,0.18)',
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
    card: '0 8px 32px rgba(99,102,241,0.08)',
    glow: '0 0 24px rgba(99,102,241,0.25)',
  },
} as const;

export type Tokens = typeof tokens;
