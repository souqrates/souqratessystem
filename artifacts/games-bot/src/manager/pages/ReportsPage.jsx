import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileDown, ScrollText, Users, ArrowUpRight, Gift } from 'lucide-react';
import {
  exportUsersCsv, exportWithdrawalsCsv, exportReferralEarningsCsv,
  listAuditLog, downloadCsv,
} from '../lib/managerDb';

const card = { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 18 };
const btn = (fg) => ({ padding: '10px 16px', borderRadius: 9, border: `1px solid ${fg}40`, background: `${fg}12`, color: fg, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 });

const REPORTS = [
  { id: 'users',        label: 'Users / Visitors',     icon: Users,        fg: '#00d4ff', fn: exportUsersCsv,           file: 'users' },
  { id: 'withdrawals',  label: 'Withdrawal Requests',  icon: ArrowUpRight, fg: '#f43f5e', fn: exportWithdrawalsCsv,     file: 'withdrawals' },
  { id: 'referrals',    label: 'Referral Earnings',    icon: Gift,         fg: '#10b981', fn: exportReferralEarningsCsv, file: 'referral_earnings' },
];

export default function ReportsPage({ adminId }) {
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 2500); };

  const load = useCallback(async () => {
    if (!adminId) return;
    const a = await listAuditLog(adminId, 200);
    setAudit(a); setLoading(false);
  }, [adminId]);

  useEffect(() => { load(); }, [load]);

  async function handleExport(r) {
    setBusy(r.id);
    try {
      const rows = await r.fn(adminId);
      if (!rows?.length) { showToast(`No rows in ${r.label}`, false); return; }
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(`${r.file}_${stamp}.csv`, rows);
      showToast(`Downloaded ${rows.length} rows`);
    } catch (e) {
      showToast('Export failed: ' + (e?.message || 'unknown'), false);
    } finally {
      setBusy('');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, background: toast.ok ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${toast.ok ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`, borderRadius: 12, padding: '12px 20px', color: toast.ok ? '#10b981' : '#ef4444', fontWeight: 700, fontSize: 13 }}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 18, color: '#fff', margin: '0 0 4px' }}>Reports & Exports</h2>
        <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.5)', margin: 0 }}>Download CSV snapshots and review the admin audit trail.</p>
      </div>

      <div style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        {REPORTS.map(r => {
          const Icon = r.icon;
          const isBusy = busy === r.id;
          return (
            <div key={r.id} style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${r.fg}22`, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: `${r.fg}14`, border: `1px solid ${r.fg}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={16} color={r.fg} />
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0 }}>{r.label}</p>
              </div>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => handleExport(r)} disabled={isBusy} style={{ ...btn(r.fg), opacity: isBusy ? 0.6 : 1 }}>
                <FileDown size={13} />{isBusy ? 'Exporting...' : 'Download CSV'}
              </motion.button>
            </div>
          );
        })}
      </div>

      <div style={card}>
        <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: 12, color: '#94a3b8', margin: '0 0 14px', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ScrollText size={12} /> ADMIN AUDIT LOG
        </p>
        {loading ? <p style={{ color: 'rgba(148,163,184,0.4)', fontSize: 12 }}>Loading...</p>
          : audit.length === 0 ? <p style={{ color: 'rgba(148,163,184,0.4)', fontSize: 12 }}>No audit entries</p>
          : (
            <div style={{ maxHeight: 480, overflow: 'auto' }}>
              {audit.map((row, i) => (
                <div key={row.id || i} style={{ display: 'flex', gap: 12, padding: '8px 4px', borderTop: i ? '1px solid rgba(255,255,255,0.04)' : 'none', fontSize: 12 }}>
                  <span style={{ color: 'rgba(148,163,184,0.5)', minWidth: 140, fontFamily: 'monospace' }}>
                    {row.created_at ? new Date(row.created_at).toLocaleString() : ''}
                  </span>
                  <span style={{ color: '#00d4ff', fontWeight: 700, minWidth: 100 }}>#{row.admin_telegram_id}</span>
                  <span style={{ color: '#fff', fontWeight: 700, minWidth: 180 }}>{row.action}</span>
                  <span style={{ color: 'rgba(148,163,184,0.55)', flex: 1, fontFamily: 'monospace', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.details ? (typeof row.details === 'string' ? row.details : JSON.stringify(row.details)) : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
