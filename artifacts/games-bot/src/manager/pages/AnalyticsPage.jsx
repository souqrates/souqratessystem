import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChartBar as BarChart2, RefreshCw, TrendingUp, Users, Gamepad2, Coins } from 'lucide-react';
import { getPlatformAnalytics } from '../lib/managerDb';

function StatCard({ label, value, sub, color, icon: Icon }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${color}22`, borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={15} color={color} />
        </div>
        <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.55)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</p>
      </div>
      <p style={{ fontSize: 28, fontWeight: 900, color, margin: '0 0 4px', fontFamily: 'Orbitron, sans-serif' }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.45)', margin: 0 }}>{sub}</p>}
    </div>
  );
}

function MiniBar({ value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.5s ease' }} />
    </div>
  );
}

export default function AnalyticsPage({ adminId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getPlatformAnalytics(adminId);
    setData(res);
    setLoading(false);
  }, [adminId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, flexDirection: 'column', gap: 12 }}>
      <RefreshCw size={22} color="rgba(148,163,184,0.4)" style={{ animation: 'spin 1s linear infinite' }} />
      <p style={{ color: 'rgba(148,163,184,0.4)', fontSize: 13, margin: 0 }}>Loading analytics…</p>

    </div>
  );

  const totals = data?.totals || {};
  const daily = data?.daily || [];
  const topGames = data?.top_games || [];
  const maxSessions = Math.max(...daily.map(d => d.sessions || 0), 1);
  const maxRevenue = Math.max(...daily.map(d => d.revenue_skz || 0), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 18, color: '#fff', margin: '0 0 4px' }}>Platform Analytics</h2>
          <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.5)', margin: 0 }}>Real-time overview of game activity and revenue</p>
        </div>
        <motion.button whileTap={{ scale: 0.96 }} onClick={load} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(148,163,184,0.7)', fontSize: 12, cursor: 'pointer' }}>
          <RefreshCw size={13} /> Refresh
        </motion.button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <StatCard label="Total Users" value={(totals.total_users ?? 0).toLocaleString()} sub="All time" color="#00d4ff" icon={Users} />
        <StatCard label="Total Sessions" value={(totals.total_sessions ?? 0).toLocaleString()} sub="All time" color="#10b981" icon={Gamepad2} />
        <StatCard label="Revenue (SKZ)" value={(totals.total_revenue_skz ?? 0).toLocaleString()} sub="Entry fees collected" color="#f59e0b" icon={Coins} />
        <StatCard label="Today's Sessions" value={(totals.today_sessions ?? 0).toLocaleString()} sub={`${totals.today_new_users ?? 0} new users today`} color="#f97316" icon={TrendingUp} />
      </div>

      {/* Daily sessions chart (last 30 days) */}
      {daily.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <BarChart2 size={16} color="#00d4ff" />
            <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 13, color: '#fff', margin: 0 }}>Daily Activity (Last 30 Days)</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120, overflowX: 'auto' }}>
            {daily.slice(-30).map((d, i) => {
              const sessH = maxSessions > 0 ? Math.max(4, (d.sessions / maxSessions) * 100) : 4;
              const revH  = maxRevenue > 0 ? Math.max(4, ((d.revenue_skz || 0) / maxRevenue) * 100) : 4;
              return (
                <div key={i} title={`${d.day}: ${d.sessions} sessions, ${d.revenue_skz || 0} SKZ`}
                  style={{ display: 'flex', alignItems: 'flex-end', gap: 2, flex: '1 0 auto', minWidth: 12 }}>
                  <div style={{ flex: 1, height: `${sessH}%`, background: 'rgba(0,212,255,0.5)', borderRadius: '2px 2px 0 0', transition: 'height 0.4s ease' }} />
                  <div style={{ flex: 1, height: `${revH}%`, background: 'rgba(16,185,129,0.5)', borderRadius: '2px 2px 0 0', transition: 'height 0.4s ease' }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(0,212,255,0.5)' }} />
              <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.5)' }}>Sessions</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(16,185,129,0.5)' }} />
              <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.5)' }}>Revenue (SKZ)</span>
            </div>
          </div>
        </div>
      )}

      {/* Top games */}
      {topGames.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 24px' }}>
          <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 13, color: '#fff', margin: '0 0 16px' }}>Top Games by Sessions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topGames.map((g, i) => {
              const maxS = topGames[0]?.sessions || 1;
              return (
                <div key={g.game_id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.4)', fontWeight: 700, minWidth: 18, textAlign: 'right' }}>#{i + 1}</span>
                  <p style={{ fontSize: 13, color: '#fff', margin: 0, minWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.game_name}</p>
                  <MiniBar value={g.sessions} max={maxS} color="#00d4ff" />
                  <span style={{ fontSize: 11, color: '#00d4ff', fontWeight: 700, minWidth: 60, textAlign: 'right' }}>{(g.sessions || 0).toLocaleString()}</span>
                  <span style={{ fontSize: 10, color: '#10b981', minWidth: 80, textAlign: 'right' }}>{(g.revenue_skz || 0).toLocaleString()} SKZ</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!data && (
        <div style={{ textAlign: 'center', padding: 40, color: 'rgba(148,163,184,0.4)', fontSize: 13 }}>
          No analytics data available yet.
        </div>
      )}


    </div>
  );
}
