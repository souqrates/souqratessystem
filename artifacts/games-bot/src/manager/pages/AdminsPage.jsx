import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Plus, Trash2, Crown } from 'lucide-react';
import { getAdmins, addAdmin, removeAdmin } from '../lib/managerDb';

export default function AdminsPage({ adminId }) {
  const [admins,  setAdmins]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [newId,   setNewId]   = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('admin');
  const [adding,  setAdding]  = useState(false);
  const [toast,   setToast]   = useState(null);

  const load = useCallback(async () => {
    if (!adminId) return;
    const data = await getAdmins(adminId);
    setAdmins(data);
    setLoading(false);
  }, [adminId]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  }

  async function handleAdd() {
    const tid = Number(newId.trim());
    if (!tid || !newName.trim()) { showToast('Enter a valid Telegram ID and name', false); return; }
    setAdding(true);
    const ok = await addAdmin(tid, newName.trim(), newRole, adminId);
    if (ok) { showToast('Admin added!'); setNewId(''); setNewName(''); await load(); }
    else showToast('Failed — ID may already exist', false);
    setAdding(false);
  }

  async function handleRemove(tid) {
    if (tid === adminId) { showToast('Cannot remove yourself', false); return; }
    const ok = await removeAdmin(tid, adminId);
    if (ok) { showToast('Admin removed'); await load(); }
    else showToast('Failed to remove', false);
  }

  const ROLE_COLORS = { superadmin: '#ffd700', admin: '#00d4ff', viewer: '#10b981' };

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
        <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 18, color: '#fff', margin: '0 0 4px' }}>Admin Management</h2>
        <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.5)', margin: 0 }}>Manage who has access to this control panel — access is restricted to Telegram IDs listed here</p>
      </div>

      {/* Add admin */}
      <div style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 16, padding: '20px' }}>
        <p style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: 13, color: '#00d4ff', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plus size={14} /> Add New Admin
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px auto', gap: 10, alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: 10, color: 'rgba(148,163,184,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Telegram ID</label>
            <input value={newId} onChange={e => setNewId(e.target.value)} placeholder="123456789" type="number"
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: '#fff', fontSize: 13, outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10, color: 'rgba(148,163,184,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Name</label>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Admin name"
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: '#fff', fontSize: 13, outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10, color: 'rgba(148,163,184,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Role</label>
            <select value={newRole} onChange={e => setNewRole(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: '#fff', fontSize: 13, outline: 'none', cursor: 'pointer' }}>
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
              <option value="superadmin">Super Admin</option>
            </select>
          </div>
          <motion.button whileTap={{ scale: 0.96 }} onClick={handleAdd} disabled={adding}
            style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid rgba(0,212,255,0.4)', background: 'rgba(0,212,255,0.12)', color: '#00d4ff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: adding ? 0.6 : 1, whiteSpace: 'nowrap' }}>
            <Plus size={14} /> Add
          </motion.button>
        </div>
      </div>

      {/* Admins list */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
              style={{ width: 32, height: 32, border: '2px solid rgba(0,212,255,0.2)', borderTop: '2px solid #00d4ff', borderRadius: '50%', margin: '0 auto' }} />
          </div>
        ) : admins.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <p style={{ color: 'rgba(148,163,184,0.3)', fontSize: 13 }}>No admins configured yet</p>
          </div>
        ) : (
          admins.map((a, i) => {
            const roleColor = ROLE_COLORS[a.role] || '#94a3b8';
            const isMe = a.telegram_id === adminId;
            return (
              <motion.div key={a.telegram_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: i < admins.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', background: isMe ? 'rgba(0,212,255,0.04)' : 'transparent' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${roleColor}14`, border: `1.5px solid ${roleColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {a.role === 'superadmin' ? <Crown size={16} color={roleColor} /> : <Shield size={16} color={roleColor} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 }}>{a.name}</p>
                    {isMe && <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 99, background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff', fontWeight: 700 }}>YOU</span>}
                  </div>
                  <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.4)', margin: '2px 0 0', fontFamily: 'monospace' }}>ID: {a.telegram_id}</p>
                </div>
                <span style={{ fontSize: 10, padding: '4px 10px', borderRadius: 8, background: `${roleColor}12`, border: `1px solid ${roleColor}30`, color: roleColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{a.role}</span>
                {!isMe && (
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleRemove(a.telegram_id)}
                    style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.07)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trash2 size={13} color="#ef4444" />
                  </motion.button>
                )}
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
