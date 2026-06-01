import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Trophy, RefreshCw, Users, Search } from 'lucide-react';
import { listAchievements, getAchievementStats } from '../lib/managerDb';

export default function AchievementsPage({ adminId }) {
  const [achievements, setAchievements] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [ach, achStats] = await Promise.all([listAchievements(), getAchievementStats()]);
    setAchievements(ach || []);
    const smap = {};
    (achStats || []).forEach(s => { smap[s.achievement_id] = s; });
    setStats(smap);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = achievements.filter(a =>
    !search || a.name?.toLowerCase().includes(search.toLowerCase()) || a.description?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, flexDirection: 'column', gap: 12 }}>
      <RefreshCw size={22} color="rgba(148,163,184,0.4)" style={{ animation: 'spin 1s linear infinite' }} />
      <p style={{ color: 'rgba(148,163,184,0.4)', fontSize: 13, margin: 0 }}>Loading achievements…</p>

    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 18, color: '#fff', margin: '0 0 4px' }}>Achievements</h2>
          <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.5)', margin: 0 }}>{achievements.length} achievements configured</p>
        </div>
        <motion.button whileTap={{ scale: 0.96 }} onClick={load}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(148,163,184,0.7)', fontSize: 12, cursor: 'pointer' }}>
          <RefreshCw size={13} /> Refresh
        </motion.button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <Search size={14} color="rgba(148,163,184,0.4)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search achievements..."
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px 10px 36px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none' }} />
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'rgba(148,163,184,0.4)', fontSize: 13 }}>
          No achievements found.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {filtered.map(a => {
            const s = stats[a.id] || {};
            const earnedCount = s.earned_count || 0;
            return (
              <motion.div key={a.id} layout
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Trophy size={22} color="rgba(245,158,11,0.8)" strokeWidth={1.6} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</p>
                    <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.5)', margin: '0 0 10px', lineHeight: 1.5 }}>{a.description}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#f59e0b' }}>
                        <Trophy size={11} />
                        {a.reward_skz ? `+${a.reward_skz} SKZ` : 'No reward'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(148,163,184,0.5)' }}>
                        <Users size={11} />
                        {earnedCount.toLocaleString()} earned
                      </div>
                      {a.required_value && (
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'rgba(255,255,255,0.05)', color: 'rgba(148,163,184,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          Target: {a.required_value}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}


    </div>
  );
}
