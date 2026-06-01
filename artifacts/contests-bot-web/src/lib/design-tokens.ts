/**
 * SOUQRATES STAGE — design tokens
 * Canonical brand palette: purple (theater/spectacle) + pink (spotlight/energy).
 *
 * CSS custom properties wired in index.css @theme:
 *   --color-stage-primary → #a855f7 (purple)
 *   --color-stage-accent  → #ec4899 (pink, already --color-stage-pink)
 *
 * Components consume via var(--color-stage-primary) — never hardcode hex.
 */
export const tokens = {
  brand: 'SOUQRATES STAGE',
  colors: {
    primary:   '#a855f7',
    accent:    '#ec4899',
    bg:        '#07050f',
    surface:   'rgba(168,85,247,0.06)',
    muted:     'rgba(148,163,184,0.5)',
    text:      '#f1f5f9',
    border:    'rgba(168,85,247,0.15)',
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
    card: '0 8px 32px rgba(168,85,247,0.08)',
    glow: '0 0 24px rgba(168,85,247,0.25)',
  },
} as const;

export type Tokens = typeof tokens;
