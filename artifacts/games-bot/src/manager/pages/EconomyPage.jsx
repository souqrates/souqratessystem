import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Save, Coins, Wallet, Percent, Settings as SettingsIcon, Globe, History, RefreshCw } from 'lucide-react';
import { listEconomySettings, setEconomySetting, getEconomyHistory } from '../lib/managerDb';

const CAT_META = {
  rates:     { label: 'Conversion Rates', color: '#10b981', icon: Coins },
  limits:    { label: 'Limits',           color: '#06b6d4', icon: Wallet },
  fees:      { label: 'Fees',             color: '#f59e0b', icon: Percent },
  providers: { label: 'Providers',        color: '#00d4ff', icon: Globe },
  ux:        { label: 'Display / UX',     color: '#94a3b8', icon: SettingsIcon },
};

export default function EconomyPage({ adminId }) {
  const [tab, setTab] = useState('settings');
  const [rows, setRows] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function load() {
    setLoading(true);
    const list = await listEconomySettings(adminId);
    setRows(list);
    setLoading(false);
  }

  async function loadHistory() {
    setHistoryLoading(true);
    const data = await getEconomyHistory(adminId, 50);
    setHistory(data || []);
    setHistoryLoading(false);
  }

  useEffect(() => { if (adminId) load(); }, [adminId]);
  useEffect(() => { if (tab === 'history' && adminId) loadHistory(); }, [tab, adminId]);

  function onChange(key, value) {
    setDrafts(d => ({ ...d, [key]: value }));
  }

  async function save(key) {
    const value = drafts[key];
    if (value === undefined) return;
    setSaving(s => ({ ...s, [key]: true }));
    setError('');
    const err = await setEconomySetting(adminId, key, value);
    setSaving(s => ({ ...s, [key]: false }));
    if (err) { setError(`${key}: ${err}`); return; }
    setRows(r => r.map(x => x.key === key ? { ...x, value: String(value) } : x));
    setDrafts(d => { const c = { ...d }; delete c[key]; return c; });
  }

  const grouped = rows.reduce((acc, r) => {
    (acc[r.category] = acc[r.category] || []).push(r);
    return acc;
  }, {});

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 22, fontWeight: 900, color: '#fff', margin: '0 0 6px' }}>Economy & Rates</h1>
        <p style={{ color: 'rgba(148,163,184,0.55)', fontSize: 13, margin: 0 }}>
          Edit conversion rates between TON, Stars, and SC plus all fees, limits, and provider settings.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, padding: 4, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)', width: 'fit-content' }}>
        {[{ id: 'settings', label: 'Settings', icon: SettingsIcon }, { id: 'history', label: 'Change History', icon: History }].map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, background: tab === t.id ? 'rgba(16,185,129,0.15)' : 'transparent', color: tab === t.id ? '#10b981' : 'rgba(148,163,184,0.6)' }}>
              <Icon size={13} /> {t.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div style={{ padding: 12, marginBottom: 16, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#fca5a5', fontSize: 13 }}>
          {error}
        </div>
      )}

      {tab === 'history' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.5)', margin: 0 }}>Recent changes to economy settings</p>
            <button onClick={loadHistory} disabled={historyLoading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'rgba(148,163,184,0.6)', fontSize: 11, cursor: 'pointer' }}>
              <RefreshCw size={11} style={{ animation: historyLoading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
            </button>
          </div>
          {historyLoading ? (
            <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 13 }}>Loading history...</p>
          ) : history.length === 0 ? (
            <p style={{ color: 'rgba(148,163,184,0.4)', fontSize: 13 }}>No changes recorded yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {history.map((h, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10 }}>
                  <span style={{ fontSize: 12, color: '#fff', fontWeight: 700, minWidth: 200 }}>{h.setting_key}</span>
                  <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.5)' }}>{h.old_value ?? '—'}</span>
                  <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.3)' }}>→</span>
                  <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>{h.new_value ?? '—'}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.35)' }}>{h.changed_at ? new Date(h.changed_at).toLocaleString() : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'settings' && loading && <p style={{ color: 'rgba(148,163,184,0.6)' }}>Loading economy settings…</p>}
      {tab === 'settings' && !loading && Object.entries(grouped).map(([cat, items]) => {
        const meta = CAT_META[cat] || { label: cat, color: '#94a3b8', icon: SettingsIcon };
        const Icon = meta.icon;
        return (
          <div key={cat} style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Icon size={18} color={meta.color} />
              <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 14, color: '#fff', margin: 0, letterSpacing: '0.08em' }}>
                {meta.label.toUpperCase()}
              </h2>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
              {items.map(row => {
                const draft = drafts[row.key];
                const dirty = draft !== undefined && String(draft) !== String(row.value);
                const isBool = row.value_type === 'bool';
                return (
                  <motion.div key={row.key} layout
                    style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${dirty ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 12, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 12, color: '#fff', fontWeight: 700, margin: '0 0 2px' }}>{row.label || row.key}</p>
                        <p style={{ fontSize: 10, color: 'rgba(148,163,184,0.5)', margin: 0, fontFamily: 'monospace' }}>{row.key}</p>
                      </div>
                      {!row.is_public && (
                        <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.12)', color: '#fca5a5', fontWeight: 700, letterSpacing: '0.05em' }}>PRIVATE</span>
                      )}
                    </div>

                    {row.description && (
                      <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.55)', margin: '0 0 10px', lineHeight: 1.5 }}>{row.description}</p>
                    )}

                    <div style={{ display: 'flex', gap: 6 }}>
                      {isBool ? (
                        <select
                          value={draft ?? row.value}
                          onChange={e => onChange(row.key, e.target.value)}
                          style={{ flex: 1, padding: '8px 10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 12 }}>
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      ) : (
                        <input
                          value={draft ?? row.value}
                          onChange={e => onChange(row.key, e.target.value)}
                          type={row.value_type === 'number' ? 'text' : 'text'}
                          inputMode={row.value_type === 'number' ? 'decimal' : 'text'}
                          style={{ flex: 1, padding: '8px 10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 12, fontFamily: 'monospace' }}
                        />
                      )}
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        disabled={!dirty || saving[row.key]}
                        onClick={() => save(row.key)}
                        style={{
                          padding: '8px 12px', borderRadius: 8,
                          background: dirty ? `${meta.color}22` : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${dirty ? `${meta.color}55` : 'rgba(255,255,255,0.06)'}`,
                          color: dirty ? meta.color : 'rgba(148,163,184,0.4)',
                          cursor: dirty ? 'pointer' : 'default',
                          fontSize: 11, fontWeight: 700,
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                        <Save size={12} />
                        {saving[row.key] ? '…' : 'SAVE'}
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

