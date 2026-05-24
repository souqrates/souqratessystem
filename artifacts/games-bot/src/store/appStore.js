import { create } from 'zustand';
import { GAMES } from '../constants';
import { getBalance, getSoloFeeTiers } from '../lib/payments';

function applyAppColors(cfg) {
  const root = document.documentElement;
  if (cfg.app_bg_color)        { root.style.setProperty('--app-bg', cfg.app_bg_color); document.body.style.background = cfg.app_bg_color; }
  if (cfg.app_primary_color)   root.style.setProperty('--app-primary', cfg.app_primary_color);
  if (cfg.app_secondary_color) root.style.setProperty('--app-secondary', cfg.app_secondary_color);
}

const SOLO_TIER_IDS = new Set([
  1,2,3,4,5,6,7,8,9,10,11,
  56,57,58,59,60,
  76,77,78,79,80,81,82,83,84,85,
  116,117,118,119,120,121,122,123,124,125,
  126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,
  146,147,148,149,150,151,152,153,154,155,156,157,158,159,160,
  161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,
  176,177,178,179,180,181,182,183,184,185,186,187,188,189,190,
  191,192,193,194,195,
  42,43,45,47,48,49,51,52,54,55,
  71,72,73,74,75,
  106,107,108,109,110,111,112,113,114,115,
]);

function applyOverrides(games, overrides, defaultSoloTier) {
  const defFee   = defaultSoloTier ? Number(defaultSoloTier.entryFee)   : null;
  const defPrize = defaultSoloTier ? Math.round(Number(defaultSoloTier.entryFee) * Number(defaultSoloTier.multiplier)) : null;

  return games
    .map(g => {
      const ov = overrides[g.id];
      const isSoloTier = SOLO_TIER_IDS.has(g.id);
      let entryFee, prize;
      if (ov) {
        entryFee = ov.entry_fee_skz != null ? Number(ov.entry_fee_skz) : (isSoloTier && defFee != null ? defFee : g.entryFee);
        prize    = ov.win_prize_skz != null ? Number(ov.win_prize_skz) : (isSoloTier && defPrize != null ? defPrize : g.prize);
      } else {
        entryFee = isSoloTier && defFee != null ? defFee : g.entryFee;
        prize    = isSoloTier && defPrize != null ? defPrize : g.prize;
      }

      if (!ov && !isSoloTier) return g;
      if (!ov) {
        return { ...g, entryFee, prize, reward: `${prize} SKZ` };
      }

      return {
        ...g,
        name:               ov.name_override       || g.name,
        emoji:              ov.emoji_override      || g.emoji,
        reward:             ov.reward_override     || `${prize} SKZ`,
        difficulty:         ov.difficulty_override || g.difficulty,
        desc:               ov.desc_override       || g.desc,
        entryFee,
        prize,
        targetScore:        ov.target_score        != null ? Number(ov.target_score)        : g.targetScore,
        durationSeconds:    ov.duration_seconds    != null ? Number(ov.duration_seconds)    : g.durationSeconds,
        trapPenalty:        ov.trap_penalty        != null ? Number(ov.trap_penalty)        : g.trapPenalty,
        scorePerHit:        ov.score_per_hit       != null ? Number(ov.score_per_hit)       : g.scorePerHit,
        scorePenalty:       ov.score_penalty       != null ? Number(ov.score_penalty)       : g.scorePenalty,
        maxScore:           ov.max_score           != null ? Number(ov.max_score)           : g.maxScore,
        soloWinScore:       ov.solo_win_score      != null ? Number(ov.solo_win_score)      : g.soloWinScore,
        maxPlausibleScore:  ov.max_plausible_score != null ? Number(ov.max_plausible_score) : g.maxPlausibleScore,
        rulesOverride:      ov.rules_override?.trim() || g.rulesOverride,
        subtitle:           ov.subtitle_override  || g.subtitle,
        winLabel:           ov.win_label_override || g.winLabel,
        loseLabel:          ov.lose_label_override|| g.loseLabel,
        ctaLabel:           ov.cta_label_override || g.ctaLabel,
        _disabled:          ov.enabled === false,
      };
    })
    .filter(g => !g._disabled)
    .map(({ _disabled, ...g }) => g);
}

const useAppStore = create((set, get) => ({
  user: null,
  wallet: (() => {
    try {
      const cached = localStorage.getItem('skz_wallet');
      if (cached) {
        const w = JSON.parse(cached);
        if (w?.sc_balance != null) return { ...w, loaded: true };
      }
    } catch { /* ignore */ }
    return { sc_balance: 0, sc_pending: 0, sc_free: 0, trial_active: false, trial_seconds_left: 0, trial_expires_at: null, is_paid: true, loaded: false };
  })(),
  currentPage:   'dashboard',
  gamesFilter:   null,
  language:      localStorage.getItem('lang') || 'en',
  notifications: [],
  selectedGame:  null,
  appConfig:        {},
  defaultSoloTier:  null,
  games:            GAMES,
  gamificationVersion: 0,
  bumpGamification: () => set((s) => ({ gamificationVersion: s.gamificationVersion + 1 })),

  pwaInstallPrompt: null,
  setPwaInstallPrompt: (e) => set({ pwaInstallPrompt: e }),

  setUser:          (user)   => set({ user }),
  setSelectedGame:  (game)   => set({ selectedGame: game }),
  setWallet:        (wallet) => set({ wallet }),
  setCurrentPage:   (page)   => set({ currentPage: page, gamesFilter: null }),
  navigateToGames:  (filter) => set({ currentPage: 'games', gamesFilter: filter }),
  setLanguage: (lang) => { localStorage.setItem('lang', lang); set({ language: lang }); },
  addNotification:    (n)  => set((s) => ({ notifications: [...s.notifications, { ...n, id: Date.now() }] })),
  removeNotification: (id) => set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),

  loadRemoteConfig: async () => {
    try {
      const soloTiers = await getSoloFeeTiers(null).catch(() => []);
      const defaultSoloTier = soloTiers.find(t => t.isDefault) || soloTiers[0] || null;

      // ── NEW: pull per-game configs from super-admin API ────────
      // Each entry overrides GAMES catalog defaults; hidden games
      // are EXCLUDED server-side and so removed from the visible list.
      let adminOverrides = {};
      let visibleIds = null;
      try {
        const base = (import.meta.env?.BASE_URL ?? '/').replace(/\/$/, '');
        const r = await fetch('/api/games/configs', { headers: { Accept: 'application/json' } });
        if (r.ok) {
          const j = await r.json();
          const arr = Array.isArray(j?.data) ? j.data : [];
          visibleIds = new Set(arr.map((g) => g.gameId));
          for (const g of arr) {
            adminOverrides[g.gameId] = {
              entry_fee_skz:    g.entryFee,
              win_prize_skz:    g.winAmount,
              name_override:    g.name,
              emoji_override:   g.emoji,
              desc_override:    g.description,
              difficulty_override: g.difficulty,
              target_score:     g.targetScore || null,
              max_score:        g.maxScore || null,
              score_per_hit:    g.scorePerCorrect ?? null,
              score_penalty:    g.scorePerWrong ?? null,
              image_url:        g.imageUrl || null,
              texts:            g.texts || {},
              params:           g.params || {},
              enabled:          true,
            };
            const t = g.texts || {};
            if (t.subtitle)  adminOverrides[g.gameId].subtitle_override  = t.subtitle;
            if (t.winLabel)  adminOverrides[g.gameId].win_label_override = t.winLabel;
            if (t.loseLabel) adminOverrides[g.gameId].lose_label_override= t.loseLabel;
            if (t.ctaLabel)  adminOverrides[g.gameId].cta_label_override = t.ctaLabel;
            if (t.rules)     adminOverrides[g.gameId].rules_override     = t.rules;
          }
        }
        void base;
      } catch { /* fall back to GAMES defaults */ }

      // Filter: if API returned a list, hide games not in it (admin-hidden or not in catalog yet)
      let merged = applyOverrides(GAMES, adminOverrides, defaultSoloTier);
      if (visibleIds) merged = merged.filter((g) => visibleIds.has(g.id));

      set({ defaultSoloTier, games: merged });
    } catch { /* keep defaults */ }
  },

  refreshBalance: async () => {
    try {
      const b = await getBalance();
      if (!b) {
        set((s) => ({ wallet: { ...s.wallet, loaded: true } }));
        return;
      }
      const w = {
        sc_balance:         Number(b.sc_balance) || 0,
        sc_pending:         Number(b.sc_pending) || 0,
        sc_free:            Number(b.sc_free)    || 0,
        trial_active:       !!b.trial_active,
        trial_seconds_left: Number(b.trial_seconds_left) || 0,
        trial_expires_at:   b.trial_expires_at || null,
        is_paid:            !!b.is_paid,
        loaded:             true,
      };
      set({ wallet: w });
      try { localStorage.setItem('skz_wallet', JSON.stringify(w)); } catch { /* ignore */ }
    } catch {
      set((s) => ({ wallet: { ...s.wallet, loaded: true } }));
    }
  },

  subscribeBalance: () => {
  },

  unsubscribeBalance: () => {
  },
}));

export default useAppStore;
