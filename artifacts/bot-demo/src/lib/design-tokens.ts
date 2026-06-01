/**
 * SOUQRATES SCRATCHY — design tokens
 * Single source of truth for colors, typography, and spacing.
 */
export const tokens = {
  brand: 'SOUQRATES SCRATCHY',
  colors: {
    primary:   '#fbbf24',
    secondary: '#f59e0b',
    bg:        '#030a05',
    surface:   '#061410',
    card:      '#0a1a0f',
    accent:    '#fde68a',
    muted:     'rgba(148,163,184,0.5)',
    text:      '#f1f5f9',
    border:    'rgba(251,191,36,0.15)',
    error:     '#f43f5e',
    success:   '#22c55e',
  },
  radii: {
    card:   '18px',
    button: '14px',
    badge:  '99px',
  },
  fonts: {
    display: '"Orbitron", sans-serif',
    body:    '"Tajawal", sans-serif',
  },
  shadows: {
    card: '0 8px 32px rgba(251,191,36,0.08)',
    glow: '0 0 24px rgba(251,191,36,0.3)',
  },
} as const;

export type Tokens = typeof tokens;
