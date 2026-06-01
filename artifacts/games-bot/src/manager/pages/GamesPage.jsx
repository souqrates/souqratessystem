import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ToggleLeft, ToggleRight, LocationEdit as Edit3, Save, X, Search, ChartBar as BarChart2, RefreshCw, Zap, Plus, Trash2, Upload, Image } from 'lucide-react';
import { GameIcon } from '../../lib/game-icons';
import { GAMES } from '../../constants';
import { getGameOverrides, getStagingGames, upsertGameOverride, getGameStats, syncAllGamesToLive, resetGame, getGameFeeTiers, upsertGameFeeTier, deleteGameFeeTier } from '../lib/managerDb';

function getCategory() {
  return 'solo';
}

export default function GamesPage({ adminId }) {
  const [overrides, setOverrides] = useState({});
  const [staged,    setStaged]    = useState({});
  const [editing,   setEditing]   = useState(null);
  const [editData,  setEditData]  = useState({});
  const [saving,    setSaving]    = useState(null);
  const [search,    setSearch]    = useState('');
  const [toast,     setToast]     = useState(null);
  const [statsFor,  setStatsFor]  = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [syncing,   setSyncing]   = useState(false);
  const [resetConfirm, setResetConfirm] = useState(null);
  // Per-game fee tiers
  const [gameTiers,     setGameTiers]     = useState({});   // { [gameId]: tier[] }
  const [savingTier,    setSavingTier]    = useState(null); // tierId or 'new-{gameId}'

  const load = useCallback(async () => {
    const [live, stagingData] = await Promise.all([getGameOverrides(), getStagingGames()]);
    const lmap = {}; live.forEach(o => { lmap[o.game_id] = o; });
    const smap = {}; stagingData.forEach(o => { smap[o.game_id] = o; });
    setOverrides(lmap);
    setStaged(smap);
  }, []);

  useEffect(() => { load(); }, [load]);

  function showToast(msg, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  }

  async function toggleGame(gameId, currentEnabled) {
    setSaving(gameId);
    const ok = await upsertGameOverride(gameId, { enabled: !currentEnabled }, adminId);
    if (ok) { await load(); showToast('Staged — go to Preview to publish live'); }
    else showToast('Failed to update', false);
    setSaving(null);
  }

  function startEdit(game) {
    loadGameTiers(game.id);
    const live = overrides[game.id] || {};
    const st   = staged[game.id] || {};
    setEditData({
      name:              st.name_override          ?? live.name_override          ?? game.name,
      emoji:             st.emoji_override         ?? live.emoji_override         ?? game.emoji,
      difficulty:        st.difficulty_override    ?? live.difficulty_override    ?? game.difficulty,
      desc:              st.desc_override          ?? live.desc_override          ?? game.desc,
      entry_fee:         st.entry_fee_skz          ?? live.entry_fee_skz          ?? game.entryFee ?? '',
      win_prize:         st.win_prize_skz          ?? live.win_prize_skz          ?? game.prize    ?? '',
      target:            st.target_score           ?? live.target_score           ?? game.targetScore ?? '',
      trap_penalty:      st.trap_penalty           ?? live.trap_penalty           ?? '',
      score_per_hit:     st.score_per_hit          ?? live.score_per_hit          ?? '',
      score_penalty:     st.score_penalty          ?? live.score_penalty          ?? '',
      max_score:         st.max_score              ?? live.max_score              ?? '',
      solo_win_score:    st.solo_win_score         ?? live.solo_win_score         ?? '',
      duration_seconds:  st.duration_seconds       ?? live.duration_seconds       ?? '',
      max_plausible_score: st.max_plausible_score  ?? live.max_plausible_score    ?? '',
      image_url:         st.image_url              ?? live.image_url              ?? '',
      rules:             st.rules_override         ?? live.rules_override         ?? '',
      win_label:         st.win_label_override     ?? live.win_label_override     ?? '',
      lose_label:        st.lose_label_override    ?? live.lose_label_override    ?? '',
      cta_label:         st.cta_label_override     ?? live.cta_label_override     ?? '',
    });
    setEditing(game.id);
    setStatsFor(null);
  }

  async function saveEdit(gameId) {
    setSaving(gameId);
    const numOrNull = (v) => v === '' || v == null ? null : Number(v);
    const game = GAMES.find(g => g.id === gameId);
    const fields = {
      name_override:       editData.name,
      emoji_override:      null,
      difficulty_override: editData.difficulty,
      desc_override:       editData.desc,
      rules_override:      editData.rules,
      win_label_override:  editData.win_label,
      lose_label_override: editData.lose_label,
      cta_label_override:  editData.cta_label,
    };
    const ts  = numOrNull(editData.target);
    const tp  = numOrNull(editData.trap_penalty);
    const sph = numOrNull(editData.score_per_hit);
    const sp  = numOrNull(editData.score_penalty);
    const ms  = numOrNull(editData.max_score);
    const sws = numOrNull(editData.solo_win_score);
    const dur = numOrNull(editData.duration_seconds);
    const mps = numOrNull(editData.max_plausible_score);
    if (ts  != null) fields.target_score         = ts;
    if (tp  != null) fields.trap_penalty         = tp;
    if (sph != null) fields.score_per_hit        = sph;
    if (sp  != null) fields.score_penalty        = sp;
    if (ms  != null) fields.max_score            = ms;
    if (sws != null) fields.solo_win_score       = sws;
    if (dur != null) fields.duration_seconds     = dur;
    if (mps != null) fields.max_plausible_score  = mps;
    if (editData.image_url?.trim()) fields.image_url = editData.image_url.trim();
    const ok = await upsertGameOverride(gameId, fields, adminId);
    if (ok) { await load(); showToast('Staged — go to Preview to publish live'); setEditing(null); }
    else showToast('Failed to save', false);
    setSaving(null);
  }

  async function openStats(gameId) {
    if (statsFor === gameId) { setStatsFor(null); return; }
    setStatsFor(gameId);
    setStatsData(null);
    setStatsLoading(true);
    const data = await getGameStats(gameId);
    setStatsData(data);
    setStatsLoading(false);
  }

  async function handleSyncAll() {
    setSyncing(true);
    const ok = await syncAllGamesToLive(adminId);
    setSyncing(false);
    showToast(ok ? 'All staged games synced to live!' : 'Sync failed', !!ok);
  }

  async function handleReset(gameId) {
    setSaving(gameId);
    const ok = await resetGame(adminId, gameId);
    setSaving(null);
    setResetConfirm(null);
    if (ok) { await load(); showToast('Game reset to defaults'); }
    else showToast('Reset failed', false);
  }

  async function loadGameTiers(gameId) {
    const tiers = await getGameFeeTiers(gameId);
    setGameTiers(prev => ({ ...prev, [gameId]: tiers }));
  }

  async function handleSaveTier(gameId, tier) {
    const key = tier.id ?? `new-${gameId}`;
    setSavingTier(key);
    const res = await upsertGameFeeTier(adminId, gameId, tier);
    setSavingTier(null);
    if (res.ok) { await loadGameTiers(gameId); showToast('Tier saved'); }
    else showToast(res.error || 'Failed to save tier', false);
  }

  async function handleDeleteTier(gameId, tierId) {
    setSavingTier(tierId);
    const res = await deleteGameFeeTier(adminId, tierId);
    setSavingTier(null);
    if (res.ok) { await loadGameTiers(gameId); showToast('Tier deleted'); }
    else showToast(res.error || 'Failed to delete tier', false);
  }

  const filtered = GAMES.filter(g => {
    return !search || g.name.toLowerCase().includes(search.toLowerCase());
  });

  const DIFF_COLORS = { Easy: '#10b981', Medium: '#f59e0b', Hard: '#ef4444' };
  const stagedCount = Object.keys(staged).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, background: toast.ok ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${toast.ok ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`, borderRadius: 12, padding: '12px 20px', color: toast.ok ? '#10b981' : '#ef4444', fontWeight: 700, fontSize: 13 }}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 18, color: '#fff', margin: '0 0 4px' }}>Games Manager</h2>
          <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.5)', margin: 0 }}>Configure games, fees, and difficulty — changes sync instantly to live</p>
        </div>
        {stagedCount > 0 && (
          <motion.button whileTap={{ scale: 0.96 }} onClick={handleSyncAll} disabled={syncing}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(0,212,255,0.4)', background: 'rgba(0,212,255,0.1)', color: '#00d4ff', fontSize: 12, fontWeight: 700, cursor: syncing ? 'wait' : 'pointer', opacity: syncing ? 0.6 : 1, flexShrink: 0 }}>
            <Zap size={13} />
            {syncing ? 'Syncing...' : `Sync All (${stagedCount})`}
          </motion.button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <Search size={14} color="rgba(148,163,184,0.4)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search games..."
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px 10px 36px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none' }} />
        </div>
        <span style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(0,212,255,0.5)', background: 'rgba(0,212,255,0.12)', color: '#00d4ff', fontSize: 12, fontWeight: 700 }}>Solo Games</span>
      </div>

      {/* Games list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(game => {
          const live = overrides[game.id] || {};
          const st   = staged[game.id] || {};
          const ov = {
            enabled:             st.enabled             ?? live.enabled,
            name_override:       st.name_override       ?? live.name_override,
            emoji_override:      st.emoji_override      ?? live.emoji_override,
            reward_override:     st.reward_override     ?? live.reward_override,
            difficulty_override: st.difficulty_override ?? live.difficulty_override,
            desc_override:       st.desc_override       ?? live.desc_override,
            win_prize_skz:       st.win_prize_skz       ?? live.win_prize_skz,
          };
          const isStaged = !!staged[game.id];
          const isEnabled = ov.enabled !== false;
          const isEditing = editing === game.id;
          const isStats   = statsFor === game.id;
          const displayName   = ov.name_override   || game.name;
          const displayReward = ov.win_prize_skz != null
            ? `${ov.win_prize_skz} SKZ`
            : (ov.reward_override || game.reward);
          const displayDiff   = ov.difficulty_override || game.difficulty;
          const diffColor = DIFF_COLORS[displayDiff] || '#94a3b8';

          return (
            <motion.div key={game.id} layout
              style={{ background: isEnabled ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.01)', border: `1px solid ${isEnabled ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)'}`, borderRadius: 14, overflow: 'hidden', opacity: isEnabled ? 1 : 0.55 }}>

              {/* Main row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
                <span style={{ flexShrink: 0, opacity: isEnabled ? 1 : 0.35 }}>
                  <GameIcon id={game.id} size={26} color={isEnabled ? '#00d4ff' : '#94a3b8'} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: isEnabled ? '#fff' : 'rgba(148,163,184,0.4)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</p>
                    {isStaged && <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 6, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', fontWeight: 700, flexShrink: 0, letterSpacing: '0.08em' }}>STAGED</span>}
                    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 6, background: `${diffColor}18`, border: `1px solid ${diffColor}35`, color: diffColor, fontWeight: 700, flexShrink: 0 }}>{displayDiff}</span>
                    <span style={{ fontSize: 10, color: '#10b981', fontWeight: 900, fontFamily: 'Orbitron, sans-serif', flexShrink: 0 }}>{displayReward}</span>
                  </div>
                  <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.4)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ov.desc_override || game.desc}</p>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => openStats(game.id)}
                    style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${isStats ? 'rgba(0,212,255,0.5)' : 'rgba(255,255,255,0.1)'}`, background: isStats ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.04)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BarChart2 size={14} color={isStats ? '#00d4ff' : 'rgba(148,163,184,0.5)'} />
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => { if (!isEditing) startEdit(game); else setEditing(null); }}
                    style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${isEditing ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.1)'}`, background: isEditing ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isEditing ? <X size={14} color="#f59e0b" /> : <Edit3 size={14} color="rgba(148,163,184,0.5)" />}
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => toggleGame(game.id, isEnabled)} disabled={saving === game.id}
                    style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${isEnabled ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.3)'}`, background: isEnabled ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.07)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: saving === game.id ? 0.5 : 1 }}>
                    {isEnabled ? <ToggleRight size={16} color="#10b981" /> : <ToggleLeft size={16} color="#ef4444" />}
                  </motion.button>
                </div>
              </div>

              {/* Stats panel */}
              <AnimatePresence>
                {isStats && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    style={{ overflow: 'hidden', borderTop: '1px solid rgba(0,212,255,0.12)', background: 'rgba(0,212,255,0.03)' }}>
                    <div style={{ padding: '14px 18px' }}>
                      <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.18em', color: 'rgba(0,212,255,0.7)', margin: '0 0 10px', textTransform: 'uppercase' }}>Game Statistics</p>
                      {statsLoading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(148,163,184,0.5)', fontSize: 12 }}>
                          <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Loading stats...
                        </div>
                      ) : statsData ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                          {[
                            { label: 'Total Sessions', value: (statsData.total_sessions ?? 0).toLocaleString(), color: '#00d4ff' },
                            { label: 'Total Wins', value: (statsData.total_wins ?? 0).toLocaleString(), color: '#10b981' },
                            { label: 'Win Rate', value: `${statsData.win_rate_pct ?? 0}%`, color: '#f59e0b' },
                            { label: 'Revenue (SKZ)', value: (statsData.total_revenue_skz ?? 0).toLocaleString(), color: '#22d3ee' },
                          ].map(s => (
                            <div key={s.label} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '10px 12px', border: `1px solid ${s.color}18` }}>
                              <p style={{ fontSize: 10, color: 'rgba(148,163,184,0.5)', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</p>
                              <p style={{ fontSize: 18, fontWeight: 900, color: s.color, margin: 0, fontFamily: 'Orbitron, sans-serif' }}>{s.value}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.4)', margin: 0 }}>No stats available yet.</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Edit panel */}
              <AnimatePresence>
                {isEditing && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    style={{ overflow: 'hidden', borderTop: '1px solid rgba(245,158,11,0.15)', background: 'rgba(245,158,11,0.03)' }}>
                    <div style={{ padding: '18px 18px 14px', overflow: 'visible' }}>
                      <div style={{ marginBottom: 10 }}>
                        <Field label="Name" value={editData.name} onChange={v => setEditData(p => ({...p, name: v}))} />
                      </div>

                      <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.18em', color: 'rgba(0,212,255,0.7)', margin: '14px 0 6px', textTransform: 'uppercase' }}>Economy (SKZ)</p>

                      <div style={{ marginBottom: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.18)' }}>
                        <p style={{ fontSize: 11, color: 'rgba(0,212,255,0.8)', margin: 0, fontWeight: 700 }}>
                          Pricing is managed by Fee Tiers below. Add at least one tier to set the entry fee and win prize.
                        </p>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginBottom: 10 }}>
                        <Field label="Target Score" value={editData.target} onChange={v => setEditData(p => ({...p, target: v}))} placeholder="500" type="number" />
                      </div>
                      <FeeTiersEditor
                        gameId={game.id}
                        tiers={gameTiers[game.id] || []}
                        savingTier={savingTier}
                        onSave={(tier) => handleSaveTier(game.id, tier)}
                        onDelete={(tierId) => handleDeleteTier(game.id, tierId)}
                      />

                      <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.18em', color: 'rgba(239,68,68,0.7)', margin: '14px 0 6px', textTransform: 'uppercase' }}>Game Mechanics</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                        <Field label="Score Per Hit" value={editData.score_per_hit} onChange={v => setEditData(p => ({...p, score_per_hit: v}))} placeholder="20" type="number" />
                        <Field label="Score Penalty" value={editData.score_penalty} onChange={v => setEditData(p => ({...p, score_penalty: v}))} placeholder="20" type="number" />
                        <Field label="Trap Penalty" value={editData.trap_penalty} onChange={v => setEditData(p => ({...p, trap_penalty: v}))} placeholder="5" type="number" />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                        <Field label="Max Score Cap" value={editData.max_score} onChange={v => setEditData(p => ({...p, max_score: v}))} placeholder="1000" type="number" />
                        <Field label="Solo Win Score" value={editData.solo_win_score} onChange={v => setEditData(p => ({...p, solo_win_score: v}))} placeholder="300" type="number" />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                        <Field label="Duration (seconds)" value={editData.duration_seconds} onChange={v => setEditData(p => ({...p, duration_seconds: v}))} placeholder="60" type="number" />
                        <Field label="Max Plausible Score" value={editData.max_plausible_score} onChange={v => setEditData(p => ({...p, max_plausible_score: v}))} placeholder="9999" type="number" />
                      </div>

                      <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.18em', color: 'rgba(16,185,129,0.7)', margin: '14px 0 6px', textTransform: 'uppercase' }}>Appearance</p>
                      <ImageUploadField
                        value={editData.image_url}
                        onChange={v => setEditData(p => ({...p, image_url: v}))}
                      />

                      <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.18em', color: 'rgba(245,158,11,0.7)', margin: '14px 0 6px', textTransform: 'uppercase' }}>Texts</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginBottom: 10 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 10, color: 'rgba(148,163,184,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Difficulty</label>
                          <select value={editData.difficulty} onChange={e => setEditData(p => ({...p, difficulty: e.target.value}))}
                            style={{ width: '100%', padding: '9px 12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }}>
                            <option value="Easy">Easy</option>
                            <option value="Medium">Medium</option>
                            <option value="Hard">Hard</option>
                          </select>
                        </div>
                        <Field label="Description" value={editData.desc} onChange={v => setEditData(p => ({...p, desc: v}))} />
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ display: 'block', fontSize: 10, color: 'rgba(148,163,184,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>How To Play (rules)</label>
                        <textarea value={editData.rules || ''} onChange={e => setEditData(p => ({...p, rules: e.target.value}))} rows={3}
                          placeholder="Leave empty to use built-in rules"
                          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
                        <Field label="CTA Button" value={editData.cta_label} onChange={v => setEditData(p => ({...p, cta_label: v}))} placeholder="PLAY" />
                        <Field label="Win Label" value={editData.win_label} onChange={v => setEditData(p => ({...p, win_label: v}))} placeholder="VICTORY!" />
                        <Field label="Lose Label" value={editData.lose_label} onChange={v => setEditData(p => ({...p, lose_label: v}))} placeholder="GAME OVER" />
                      </div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ position: 'relative' }}>
                          {resetConfirm === game.id ? (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <span style={{ fontSize: 11, color: '#ef4444' }}>Reset to defaults?</span>
                              <button onClick={() => handleReset(game.id)} disabled={saving === game.id}
                                style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Yes</button>
                              <button onClick={() => setResetConfirm(null)}
                                style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(148,163,184,0.5)', fontSize: 11, cursor: 'pointer' }}>No</button>
                            </div>
                          ) : (
                            <button onClick={() => setResetConfirm(game.id)}
                              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.07)', color: '#ef4444', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                              Reset Defaults
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => setEditing(null)}
                            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(148,163,184,0.5)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                          <motion.button whileTap={{ scale: 0.96 }} onClick={() => saveEdit(game.id)} disabled={saving === game.id}
                            style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(245,158,11,0.5)', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: saving === game.id ? 0.6 : 1 }}>
                            <Save size={12} /> Save Changes
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 10, color: 'rgba(148,163,184,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{label}</label>
      <input type={type || 'text'} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }} />
    </div>
  );
}

const EMPTY_TIER = { label: '', entry_fee: '', prize_multiplier: '', is_default: false };

function FeeTiersEditor({ gameId, tiers, savingTier, onSave, onDelete }) {
  const [draft, setDraft] = useState(null); // null = hidden, obj = editing
  const [editingId, setEditingId] = useState(null);
  const [editRow, setEditRow] = useState(null);

  const canAdd = tiers.length < 5;

  function openAdd() { setDraft({ ...EMPTY_TIER }); }
  function cancelAdd() { setDraft(null); }

  function openEditRow(t) {
    setEditingId(t.id);
    setEditRow({ label: t.label, entry_fee: String(t.entry_fee ?? ''), prize_multiplier: String(t.multiplier ?? ''), is_default: !!t.is_default });
  }
  function cancelEditRow() { setEditingId(null); setEditRow(null); }

  return (
    <div style={{ marginTop: 14, marginBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.18em', color: 'rgba(0,212,255,0.7)', margin: 0, textTransform: 'uppercase' }}>
          Fee Tiers (up to 5) — {tiers.length}/5
        </p>
        <button
          onClick={openAdd}
          disabled={!canAdd || draft !== null}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(0,212,255,0.35)', background: 'rgba(0,212,255,0.08)', color: canAdd ? '#00d4ff' : 'rgba(148,163,184,0.3)', fontSize: 11, fontWeight: 700, cursor: canAdd && !draft ? 'pointer' : 'default', opacity: canAdd && !draft ? 1 : 0.5 }}>
          <Plus size={11} /> Add Tier
        </button>
      </div>

      {/* Existing tiers */}
      {tiers.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: draft ? 10 : 0 }}>
          {tiers.map(t => (
            <div key={t.id} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 9, border: '1px solid rgba(255,255,255,0.07)', padding: '10px 12px' }}>
              {editingId === t.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
                    <MiniField label="Label" value={editRow.label} onChange={v => setEditRow(p => ({...p, label: v}))} placeholder="e.g. Standard" />
                    <MiniField label="Entry (SKZ)" value={editRow.entry_fee} onChange={v => setEditRow(p => ({...p, entry_fee: v}))} placeholder="10" type="number" />
                    <MiniField label="Multiplier" value={editRow.prize_multiplier} onChange={v => setEditRow(p => ({...p, prize_multiplier: v}))} placeholder="2.5" type="number" />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(148,163,184,0.6)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={editRow.is_default} onChange={e => setEditRow(p => ({...p, is_default: e.target.checked}))} />
                      Default tier
                    </label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={cancelEditRow}
                        style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(148,163,184,0.5)', fontSize: 11, cursor: 'pointer' }}>
                        Cancel
                      </button>
                      <button
                        disabled={savingTier === t.id}
                        onClick={() => { onSave({ id: t.id, ...editRow, entry_fee: Number(editRow.entry_fee), prize_multiplier: Number(editRow.prize_multiplier) }); cancelEditRow(); }}
                        style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.12)', color: '#f59e0b', fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: savingTier === t.id ? 0.6 : 1 }}>
                        {savingTier === t.id ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', minWidth: 60 }}>{t.label || '(no label)'}</span>
                    <span style={{ fontSize: 11, color: '#00d4ff', fontFamily: 'Orbitron, sans-serif', fontWeight: 900 }}>{t.entryFee} SKZ</span>
                    <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.4)' }}>×{t.multiplier}</span>
                    <span style={{ fontSize: 10, color: '#10b981', fontWeight: 700 }}>win {Math.round(t.entryFee * t.multiplier)} SKZ</span>
                    {t.isDefault && <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 5, background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff', fontWeight: 700 }}>DEFAULT</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                    <button onClick={() => openEditRow(t)}
                      style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Edit3 size={11} color="#f59e0b" />
                    </button>
                    <button
                      disabled={savingTier === t.id}
                      onClick={() => onDelete(t.id)}
                      style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: savingTier === t.id ? 0.5 : 1 }}>
                      <Trash2 size={11} color="#ef4444" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add new tier form */}
      {draft && (
        <div style={{ background: 'rgba(0,212,255,0.04)', borderRadius: 9, border: '1px solid rgba(0,212,255,0.2)', padding: '12px 12px 10px' }}>
          <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.15em', color: 'rgba(0,212,255,0.6)', margin: '0 0 8px', textTransform: 'uppercase' }}>New Tier</p>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            <MiniField label="Label" value={draft.label} onChange={v => setDraft(p => ({...p, label: v}))} placeholder="e.g. Standard" />
            <MiniField label="Entry (SKZ)" value={draft.entry_fee} onChange={v => setDraft(p => ({...p, entry_fee: v}))} placeholder="10" type="number" />
            <MiniField label="Multiplier" value={draft.prize_multiplier} onChange={v => setDraft(p => ({...p, prize_multiplier: v}))} placeholder="2.5" type="number" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(148,163,184,0.6)', cursor: 'pointer' }}>
              <input type="checkbox" checked={draft.is_default} onChange={e => setDraft(p => ({...p, is_default: e.target.checked}))} />
              Set as default
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={cancelAdd}
                style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(148,163,184,0.5)', fontSize: 11, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                disabled={!draft.entry_fee || !draft.prize_multiplier || savingTier === `new-${gameId}`}
                onClick={() => { onSave({ ...draft, entry_fee: Number(draft.entry_fee), prize_multiplier: Number(draft.prize_multiplier) }); cancelAdd(); }}
                style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid rgba(0,212,255,0.4)', background: 'rgba(0,212,255,0.12)', color: '#00d4ff', fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: (!draft.entry_fee || !draft.prize_multiplier) ? 0.5 : 1 }}>
                {savingTier === `new-${gameId}` ? 'Saving...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tiers.length === 0 && !draft && (
        <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.35)', margin: '0 0 4px', fontStyle: 'italic' }}>
          No custom tiers — players use global fee tiers. Add tiers to override per-game.
        </p>
      )}
    </div>
  );
}

function MiniField({ label, value, onChange, placeholder, type }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 9, color: 'rgba(148,163,184,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</label>
      <input type={type || 'text'} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', fontSize: 12, outline: 'none' }} />
    </div>
  );
}

function ImageUploadField({ value, onChange }) {
  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => onChange(e.target.result);
    reader.readAsDataURL(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }

  const hasImage = value && value.length > 0;

  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 10, color: 'rgba(148,163,184,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
        Game Image
      </label>

      {/* Drop zone / preview */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          position: 'relative',
          width: '100%',
          height: hasImage ? 140 : 80,
          borderRadius: 10,
          border: `2px dashed ${dragOver ? 'rgba(16,185,129,0.7)' : hasImage ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.12)'}`,
          background: dragOver ? 'rgba(16,185,129,0.06)' : hasImage ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.02)',
          cursor: 'pointer',
          overflow: 'hidden',
          transition: 'border-color 0.2s, background 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {hasImage ? (
          <>
            <img
              src={value}
              alt="Game preview"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}
            />
            {/* Overlay on hover */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.55)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              opacity: 0,
              transition: 'opacity 0.2s',
            }}
              onMouseEnter={e => e.currentTarget.style.opacity = 1}
              onMouseLeave={e => e.currentTarget.style.opacity = 0}
            >
              <Upload size={20} color="#fff" />
              <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>Change Image</span>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, pointerEvents: 'none' }}>
            <Image size={22} color="rgba(148,163,184,0.35)" />
            <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.4)', fontWeight: 600 }}>
              Click or drag & drop an image
            </span>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files[0])}
      />

      {/* Actions row */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.08)', color: '#10b981', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
        >
          <Upload size={12} /> Upload from device
        </button>
        {hasImage && (
          <button
            type="button"
            onClick={() => onChange('')}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.07)', color: '#ef4444', fontSize: 11, cursor: 'pointer' }}
          >
            <X size={12} /> Remove
          </button>
        )}
      </div>
    </div>
  );
}
