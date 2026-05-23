import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, TrendingUp, Gamepad2, DollarSign, Activity, ArrowUpRight } from 'lucide-react';
import { getVisitorStats, getVisitors } from '../lib/managerDb';

export default function OverviewPage({ adminId }) {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!adminId) return;
    let cancelled = false;
    async function load() {
      try {
        const [s, v] = await Promise.all([
          getVisitorStats(adminId),
          getVisitors(adminId, { limit: 8, orderBy: 'last_seen' }),
        ]);
        if (cancelled) return;
        setStats(s);
        setRecent(v);
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const iv = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [adminId]);

  const cards = stats ? [
    { label: 'Total Users',    value: stats.totalUsers.toLocaleString(), icon: Users,     color: '#00d4ff',  sub: 'All registered users' },
    { label: 'Active Today',   value: stats.activeToday.toLocaleString(), icon: Activity,  color: '#10b981',  sub: 'Users seen in 24h' },
    { label: 'Total Deposited',value: `${stats.spent.toFixed(2)} SKZ`,    icon: DollarSign, color: '#f59e0b', sub: 'Sum of all deposits' },
    { label: 'Games Played',   value: stats.games.toLocaleString(),        icon: Gamepad2,  color: '#f97316',  sub: 'All-time game sessions' },
  ] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 18, color: '#fff', margin: '0 0 4px' }}>Platform Overview</h2>
        <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.5)', margin: 0 }}>Real-time stats — updates every 15 seconds</p>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 20, height: 110 }}>
              <motion.div animate={{ opacity: [0.3,0.6,0.3] }} transition={{ duration: 1.5, repeat: Infinity }}
                style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8, height: 16, width: '60%', marginBottom: 12 }} />
              <motion.div animate={{ opacity: [0.3,0.6,0.3] }} transition={{ duration: 1.5, delay: 0.2, repeat: Infinity }}
                style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8, height: 28, width: '40%' }} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {cards.map((c, i) => {
            const Icon = c.icon;
            return (
              <motion.div key={c.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                style={{ background: `${c.color}06`, border: `1px solid ${c.color}20`, borderRadius: 16, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 14, right: 14, width: 36, height: 36, borderRadius: 10, background: `${c.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={17} color={c.color} />
                </div>
                <p style={{ fontSize: 10, color: `${c.color}99`, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>{c.label}</p>
                <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 26, color: '#fff', margin: '0 0 4px' }}>{c.value}</p>
                <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.4)', margin: 0 }}>{c.sub}</p>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Recent visitors */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: 13, color: '#fff', margin: 0 }}>Recent Visitors</p>
          <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.4)', fontWeight: 600 }}>LIVE</span>
        </div>
        {recent.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <p style={{ color: 'rgba(148,163,184,0.3)', fontSize: 13, margin: 0 }}>No visitors yet — they'll appear here as users open the bot</p>
          </div>
        ) : (
          <div>
            {recent.map((v, i) => (
              <motion.div key={v.telegram_id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', borderBottom: i < recent.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 13, color: '#00d4ff', flexShrink: 0 }}>
                  {(v.first_name || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v.first_name}{v.username ? ` @${v.username}` : ''}
                  </p>
                  <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.4)', margin: 0 }}>
                    ID: {v.telegram_id} · {v.session_count} sessions · {v.games_played} games
                  </p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#10b981', margin: '0 0 2px' }}>{Number(v.total_spent).toFixed(2)} SKZ</p>
                  <p style={{ fontSize: 10, color: 'rgba(148,163,184,0.35)', margin: 0 }}>{new Date(v.last_seen).toLocaleDateString()}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
