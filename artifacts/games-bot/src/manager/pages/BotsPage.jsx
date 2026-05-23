import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Save, Check } from 'lucide-react';
import { getBotSmartConfig, updateBotSmartConfig } from '../lib/managerDb';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function BotsPage({ adminId }) {
  const [cfg, setCfg]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [err, setErr]         = useState('');

  useEffect(() => {
    (async () => {
      const data = await getBotSmartConfig();
      setCfg(data || {});
      setLoading(false);
    })();
  }, []);

  function update(field, value) {
    setCfg(c => ({ ...c, [field]: value }));
  }

  function togglePeakHour(h) {
    const cur = Array.isArray(cfg.peak_hours) ? cfg.peak_hours : [];
    const next = cur.includes(h) ? cur.filter(x => x !== h) : [...cur, h].sort((a, b) => a - b);
    update('peak_hours', next);
  }

  async function save() {
    setErr(''); setSaving(true);
    const fields = {
      enable_pvp: !!cfg.enable_pvp,
      enable_quad: !!cfg.enable_quad,
      enable_group: !!cfg.enable_group,
      pvp_join_probability: Number(cfg.pvp_join_probability) || 0,
      quad_join_probability: Number(cfg.quad_join_probability) || 0,
      group_join_probability: Number(cfg.group_join_probability) || 0,
      pvp_min_wait_ms: Number(cfg.pvp_min_wait_ms) || 0,
      pvp_max_wait_ms: Number(cfg.pvp_max_wait_ms) || 0,
      quad_min_wait_ms: Number(cfg.quad_min_wait_ms) || 0,
      quad_max_wait_ms: Number(cfg.quad_max_wait_ms) || 0,
      group_min_wait_ms: Number(cfg.group_min_wait_ms) || 0,
      group_max_wait_ms: Number(cfg.group_max_wait_ms) || 0,
      peak_hours: Array.isArray(cfg.peak_hours) ? cfg.peak_hours.map(Number) : [],
      peak_probability_multiplier: Number(cfg.peak_probability_multiplier) || 0,
    };
    const e = await updateBotSmartConfig(adminId, fields);
    setSaving(false);
    if (e) { setErr(e); return; }
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  if (loading) {
    return <p style={{ color: 'rgba(148,163,184,0.5)' }}>Loading bot config...</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 18, color: '#fff', margin: '0 0 4px' }}>Smart Bot Engine</h2>
        <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.5)', margin: 0 }}>
          Control when bots join multiplayer games. Disable per mode, set per-mode join probability,
          tune wait windows, and reduce bot pressure during peak hours when real players match faster.
        </p>
      </div>

      {[
        { id: 'pvp',   label: '2-Player', color: '#00d4ff' },
        { id: 'quad',  label: '4-Player', color: '#f59e0b' },
        { id: 'group', label: 'Group / Tournament', color: '#10b981' },
      ].map(m => (
        <div key={m.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Bot size={16} color={m.color} />
              <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 800, fontSize: 13, color: '#fff', margin: 0 }}>{m.label}</p>
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!cfg[`enable_${m.id}`]} onChange={e => update(`enable_${m.id}`, e.target.checked)} />
              <span style={{ fontSize: 12, color: 'rgba(148,163,184,0.7)' }}>Enable</span>
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Num label="Join Probability (0-1)" step="0.01" value={cfg[`${m.id}_join_probability`]} onChange={v => update(`${m.id}_join_probability`, v)} />
            <Num label="Min Wait (ms)"          value={cfg[`${m.id}_min_wait_ms`]}      onChange={v => update(`${m.id}_min_wait_ms`, v)} />
            <Num label="Max Wait (ms)"          value={cfg[`${m.id}_max_wait_ms`]}      onChange={v => update(`${m.id}_max_wait_ms`, v)} />
          </div>
        </div>
      ))}

      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 18 }}>
        <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 800, fontSize: 13, color: '#fff', margin: '0 0 4px' }}>Peak Hours</p>
        <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.5)', margin: '0 0 12px' }}>
          During peak hours bot join probability is multiplied by the value below, so real players match each other first.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {HOURS.map(h => {
            const active = (cfg.peak_hours || []).includes(h);
            return (
              <button key={h} onClick={() => togglePeakHour(h)}
                style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${active ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  background: active ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.03)', color: active ? '#00d4ff' : 'rgba(148,163,184,0.6)',
                  fontFamily: 'Orbitron, sans-serif', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                {String(h).padStart(2, '0')}
              </button>
            );
          })}
        </div>
        <div style={{ maxWidth: 280 }}>
          <Num label="Peak Multiplier (0-1)" step="0.05" value={cfg.peak_probability_multiplier} onChange={v => update('peak_probability_multiplier', v)} />
        </div>
      </div>

      {err && <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>{err}</p>}

      <motion.button whileTap={{ scale: 0.97 }} onClick={save} disabled={saving}
        style={{ alignSelf: 'flex-start', padding: '12px 24px', borderRadius: 12, border: '1px solid rgba(0,212,255,0.4)',
          background: saved ? 'rgba(16,185,129,0.15)' : 'rgba(0,212,255,0.12)', color: saved ? '#10b981' : '#00d4ff',
          fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 12, letterSpacing: '0.1em',
          cursor: saving ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
        {saved ? <Check size={14} /> : <Save size={14} />}
        {saved ? 'SAVED' : saving ? 'SAVING...' : 'SAVE CHANGES'}
      </motion.button>
    </div>
  );
}

function Num({ label, value, onChange, step = '1' }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 10, color: 'rgba(148,163,184,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</label>
      <input type="number" step={step} value={value ?? ''} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          color: '#fff', fontSize: 13, outline: 'none' }} />
    </div>
  );
}
