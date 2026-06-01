/**
 * SOUQRATES SOUQ — design tokens
 * Canonical brand palette: green (growth/marketplace) + gold (premium value).
 *
 * CSS custom properties wired in index.css :root:
 *   --souq-primary  → #22c55e (green)
 *   --souq-accent   → #eab308 (gold)
 *   --souq-surface  → rgba(34,197,94,0.06)
 *   --souq-border   → rgba(34,197,94,0.15)
 *   --souq-glow     → rgba(34,197,94,0.25)
 *
 * Components consume via var(--souq-*) — never hardcode these hex values.
 */
export const tokens = {
  brand: 'SOUQRATES SOUQ',
  colors: {
    primary:   '#22c55e',
    accent:    '#eab308',
    bg:        '#04030a',
    surface:   'rgba(34,197,94,0.06)',
    muted:     'rgba(148,163,184,0.5)',
    text:      '#f1f5f9',
    border:    'rgba(34,197,94,0.15)',
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
    card: '0 8px 32px rgba(34,197,94,0.08)',
    glow: '0 0 24px rgba(34,197,94,0.25)',
  },
} as const;

export type Tokens = typeof tokens;
