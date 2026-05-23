// Abstract avatar generator. Returns data:image/svg+xml URLs so we never
// depend on external image hosts and we never use human photos.
//
// Each preset is a deterministic gradient + geometric mark on a square canvas.
// The same preset id always renders the same artwork so saved profiles look
// stable across sessions.

const PRESETS = [
  { id: 'aurora',   c1: '#22d3ee', c2: '#0ea5e9', shape: 'orb'      },
  { id: 'ember',    c1: '#f59e0b', c2: '#ef4444', shape: 'flame'    },
  { id: 'forest',   c1: '#34d399', c2: '#0d9488', shape: 'hex'      },
  { id: 'sunset',   c1: '#fb7185', c2: '#f97316', shape: 'rings'    },
  { id: 'sky',      c1: '#60a5fa', c2: '#22d3ee', shape: 'wave'     },
  { id: 'mint',     c1: '#a7f3d0', c2: '#10b981', shape: 'diamond'  },
  { id: 'gold',     c1: '#fde047', c2: '#ca8a04', shape: 'star'     },
  { id: 'rose',     c1: '#fda4af', c2: '#be123c', shape: 'orb'      },
  { id: 'ocean',    c1: '#0ea5e9', c2: '#1e3a8a', shape: 'triangle' },
  { id: 'crimson',  c1: '#f43f5e', c2: '#7f1d1d', shape: 'shield'   },
  { id: 'jade',     c1: '#67e8f9', c2: '#0e7490', shape: 'rings'    },
  { id: 'amber',    c1: '#fcd34d', c2: '#b45309', shape: 'hex'      },
  { id: 'lime',     c1: '#bef264', c2: '#365314', shape: 'diamond'  },
  { id: 'coral',    c1: '#fb923c', c2: '#dc2626', shape: 'flame'    },
  { id: 'arctic',   c1: '#e0f2fe', c2: '#0369a1', shape: 'wave'     },
  { id: 'lagoon',   c1: '#5eead4', c2: '#0f766e', shape: 'orb'      },
  { id: 'sunrise',  c1: '#fef3c7', c2: '#f59e0b', shape: 'star'     },
  { id: 'mariner',  c1: '#7dd3fc', c2: '#1d4ed8', shape: 'triangle' },
];

function shapeMarkup(shape, c1, c2) {
  switch (shape) {
    case 'orb':
      return `
        <circle cx="100" cy="100" r="52" fill="rgba(255,255,255,0.18)" />
        <circle cx="80"  cy="84"  r="20" fill="rgba(255,255,255,0.35)" />
      `;
    case 'flame':
      return `
        <path d="M100 40 C 130 80 145 100 130 140 C 120 168 80 168 70 140 C 55 100 80 80 100 40 Z"
              fill="rgba(255,255,255,0.22)" />
        <circle cx="100" cy="130" r="14" fill="rgba(255,255,255,0.5)" />
      `;
    case 'hex':
      return `
        <polygon points="100,42 152,72 152,128 100,158 48,128 48,72"
                 fill="rgba(255,255,255,0.18)"
                 stroke="rgba(255,255,255,0.35)" stroke-width="3" />
        <polygon points="100,72 130,87 130,113 100,128 70,113 70,87"
                 fill="rgba(255,255,255,0.28)" />
      `;
    case 'rings':
      return `
        <circle cx="100" cy="100" r="58" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="6" />
        <circle cx="100" cy="100" r="40" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="5" />
        <circle cx="100" cy="100" r="20" fill="rgba(255,255,255,0.45)" />
      `;
    case 'wave':
      return `
        <path d="M30 130 Q 60 90 100 120 T 170 110" fill="none"
              stroke="rgba(255,255,255,0.45)" stroke-width="8" stroke-linecap="round" />
        <path d="M30 100 Q 60 60 100 90 T 170 80" fill="none"
              stroke="rgba(255,255,255,0.22)" stroke-width="6" stroke-linecap="round" />
      `;
    case 'diamond':
      return `
        <polygon points="100,40 158,100 100,160 42,100" fill="rgba(255,255,255,0.18)"
                 stroke="rgba(255,255,255,0.35)" stroke-width="3" />
        <polygon points="100,68 132,100 100,132 68,100" fill="rgba(255,255,255,0.28)" />
      `;
    case 'star':
      return `
        <polygon points="100,42 116,86 162,90 126,118 138,162 100,138 62,162 74,118 38,90 84,86"
                 fill="rgba(255,255,255,0.32)" stroke="rgba(255,255,255,0.42)" stroke-width="2" />
      `;
    case 'triangle':
      return `
        <polygon points="100,46 160,154 40,154" fill="rgba(255,255,255,0.18)"
                 stroke="rgba(255,255,255,0.35)" stroke-width="3" />
        <polygon points="100,82 134,140 66,140" fill="rgba(255,255,255,0.32)" />
      `;
    case 'shield':
      return `
        <path d="M100 40 L 156 64 L 156 110 C 156 140 130 158 100 168 C 70 158 44 140 44 110 L 44 64 Z"
              fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.35)" stroke-width="3" />
        <path d="M100 70 L 130 82 L 130 110 C 130 130 116 142 100 148 C 84 142 70 130 70 110 L 70 82 Z"
              fill="rgba(255,255,255,0.30)" />
      `;
    default:
      return `<circle cx="100" cy="100" r="48" fill="rgba(255,255,255,0.25)" />`;
  }
}

function buildSvg({ c1, c2, shape, id }) {
  const grad = `grad-${id}`;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <defs>
    <linearGradient id="${grad}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <radialGradient id="${grad}-glow" cx="0.3" cy="0.25" r="0.9">
      <stop offset="0%" stop-color="rgba(255,255,255,0.45)"/>
      <stop offset="60%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
  </defs>
  <rect width="200" height="200" rx="42" fill="url(#${grad})"/>
  <rect width="200" height="200" rx="42" fill="url(#${grad}-glow)"/>
  ${shapeMarkup(shape, c1, c2)}
</svg>`.trim();
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const AVATAR_PRESETS = PRESETS.map((p) => ({
  id: p.id,
  url: buildSvg(p),
  c1: p.c1,
  c2: p.c2,
}));

export function isAbstractAvatar(url) {
  return typeof url === 'string' && url.startsWith('data:image/svg+xml');
}

export function defaultAvatarFor(seed) {
  if (!seed) return AVATAR_PRESETS[0].url;
  let h = 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % AVATAR_PRESETS.length;
  return AVATAR_PRESETS[idx].url;
}
