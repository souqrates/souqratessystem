import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import {
  ArrowUpRight, ArrowDownLeft, Clock, Coins,
  Wallet as WalletIcon, Zap, RefreshCw, Info,
} from 'lucide-react';
import useAppStore from '../store/appStore';
import { t } from '../lib/i18n';
import { triggerHaptic } from '../lib/telegram';
import {
  getBalance, listLedger,
  createTonDepositIntent, requestTonWithdrawal,
  createStarsInvoice, openStarsInvoice,
} from '../lib/payments';

const container = { animate: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } } };
const item = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
};

const TON_PRESETS = [1, 2, 5, 10];
const TON_ADDRESS_RE = /^(UQ|EQ)[A-Za-z0-9_-]{46}$|^0:[0-9a-fA-F]{64}$/;

function num(v, def = 0) { const n = Number(v); return Number.isFinite(n) ? n : def; }

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

function TxIcon({ type }) {
  if (type === 'credit' || type === 'deposit' || type === 'referral_bonus') {
    return <ArrowDownLeft size={13} style={{ color: '#10b981' }} />;
  }
  return <ArrowUpRight size={13} style={{ color: '#ef4444' }} />;
}

export default function Wallet() {
  const { language } = useAppStore();
  const [tab, setTab] = useState('buy');
  const [balance, setBalance] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const [tonAmount, setTonAmount] = useState(2);
  const [tonAddress, setTonAddress] = useState('');
  const [addressError, setAddressError] = useState('');
  const [scAmount, setScAmount] = useState('');
  const [tonIntent, setTonIntent] = useState(null);
  const [copiedField, setCopiedField] = useState('');

  const [starsAmount, setStarsAmount] = useState(50);

  const refresh = useCallback(async () => {
    try {
      const [b, l] = await Promise.all([
        getBalance().catch(() => null),
        listLedger({ limit: 20 }).catch(() => []),
      ]);
      setBalance(b);
      setLedger(l);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const skzBalance = num(balance?.sc_balance, 0);
  const skzPerTon  = 500;
  const skzPerStar = 1;

  function copyToClipboard(text, field) {
    if (!text) return;
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedField(field);
    triggerHaptic('success');
    setTimeout(() => setCopiedField(''), 1500);
  }

  async function handleCreateTonIntent() {
    if (busy) return;
    if (tonAmount <= 0) { setNotice({ type: 'error', text: 'Enter a TON amount' }); return; }
    setBusy(true); setNotice(null);
    try {
      const res = await createTonDepositIntent(tonAmount);
      if (!res?.ok) { setNotice({ type: 'error', text: 'Could not create deposit request' }); return; }
      setTonIntent(res);
      triggerHaptic('success');
    } catch (e) {
      setNotice({ type: 'error', text: e?.message || 'Could not create deposit request' });
    } finally { setBusy(false); }
  }

  async function handleStarsInvoice() {
    if (busy) return;
    if (starsAmount <= 0) { setNotice({ type: 'error', text: 'Enter Stars amount' }); return; }
    setBusy(true); setNotice(null);
    try {
      const res = await createStarsInvoice(starsAmount);
      if (!res?.ok || !res?.invoiceLink) { setNotice({ type: 'error', text: 'Could not create invoice' }); return; }
      triggerHaptic('success');
      await openStarsInvoice(res.invoiceLink);
      setTimeout(refresh, 2000);
    } catch (e) {
      setNotice({ type: 'error', text: e?.message || 'Could not create invoice' });
    } finally { setBusy(false); }
  }

  async function handleWithdraw() {
    if (busy) return;
    const amt = Number(scAmount);
    if (!amt || amt <= 0) { setNotice({ type: 'error', text: 'Enter an amount to withdraw' }); return; }
    if (amt > skzBalance) { setNotice({ type: 'error', text: 'Insufficient SKZ balance' }); return; }
    const clean = tonAddress.trim();
    if (!clean || !TON_ADDRESS_RE.test(clean)) {
      setNotice({ type: 'error', text: 'Enter a valid TON address (UQ… or EQ…)' }); return;
    }
    setBusy(true); setNotice(null);
    try {
      const res = await requestTonWithdrawal({ amountSc: amt, tonAddress: clean });
      triggerHaptic('success');
      setNotice({ type: 'success', text: res?.message || 'Withdrawal request submitted. Processing shortly.' });
      setScAmount(''); setTonAddress(''); setAddressError('');
      setTimeout(refresh, 600);
    } catch (e) {
      setNotice({ type: 'error', text: e?.message || 'Could not submit withdrawal' });
    } finally { setBusy(false); }
  }

  function handleAddressChange(val) {
    setTonAddress(val);
    const clean = val.trim();
    if (!clean) { setAddressError(''); return; }
    if (clean.length < 32) { setAddressError('Address too short'); return; }
    if (!TON_ADDRESS_RE.test(clean)) {
      setAddressError('Invalid TON address (must start with UQ or EQ)');
    } else {
      setAddressError('');
    }
  }

  return (
    <motion.div className="px-4 pt-5 pb-6 space-y-4 relative z-10" variants={container} initial="initial" animate="animate">
      <motion.div variants={item} className="flex items-center gap-2.5">
        <WalletIcon size={17} style={{ color: '#10b981', filter: 'drop-shadow(0 0 8px rgba(16,185,129,0.9))' }} />
        <h1 className="font-orbitron text-base font-black text-white tracking-widest">{t(language, 'wallet')}</h1>
      </motion.div>

      {/* Unified wallet notice */}
      <motion.div variants={item} className="rounded-2xl px-4 py-3 flex items-center gap-2.5"
        style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
        <Info size={13} style={{ color: '#10b981', flexShrink: 0 }} />
        <p style={{ fontSize: 11, color: 'rgba(16,185,129,0.9)', lineHeight: 1.5 }}>
          رصيدك موحّد عبر جميع بوتات المنصة — أي إيداع هنا يظهر فوراً في كل البوتات.
        </p>
      </motion.div>

      {/* Balance Hero */}
      <motion.div variants={item} className="glass-hero rounded-3xl p-5 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(16,185,129,0.12)' }} />
        <div className="flex items-center gap-1.5 mb-2 relative z-10">
          <Coins size={11} style={{ color: '#10b981' }} />
          <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.78)' }}>
            SKZ Balance · Unified Wallet
          </p>
          <button onClick={refresh} className="ml-auto p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <RefreshCw size={11} style={{ color: 'rgba(148,163,184,0.6)' }} />
          </button>
        </div>
        <div className="flex items-baseline gap-2 mb-1 relative z-10">
          <p className="font-orbitron text-4xl font-black text-white">{skzBalance.toLocaleString()}</p>
          <p className="font-orbitron text-sm font-black" style={{ color: '#10b981' }}>SKZ</p>
        </div>
        {balance?.balanceTon && Number(balance.balanceTon) > 0 && (
          <p className="text-[10px] relative z-10 mt-0.5" style={{ color: 'rgba(34,211,238,0.7)' }}>
            TON: <span className="font-orbitron font-black" style={{ color: '#22d3ee' }}>{Number(balance.balanceTon).toFixed(4)}</span>
          </p>
        )}
        {balance?.totalEarnedSkz && (
          <p className="text-[10px] relative z-10 mt-0.5" style={{ color: 'rgba(148,163,184,0.5)' }}>
            Total earned: <span style={{ color: 'rgba(16,185,129,0.8)' }}>{Number(balance.totalEarnedSkz).toLocaleString()} SKZ</span>
          </p>
        )}
      </motion.div>

      {/* Tabs */}
      <motion.div variants={item} className="flex gap-1.5 glass-card rounded-2xl p-1">
        {[
          { id: 'buy',      label: 'Buy',      icon: ArrowDownLeft },
          { id: 'withdraw', label: 'Withdraw', icon: ArrowUpRight  },
          { id: 'history',  label: 'History',  icon: Clock         },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => { setTab(id); setNotice(null); }}
            className="flex-1 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all duration-200"
            style={tab === id ? {
              background: 'linear-gradient(135deg, #047857, #10b981)',
              border: '1px solid rgba(16,185,129,0.35)',
              color: '#fff',
              boxShadow: '0 2px 12px rgba(16,185,129,0.25)',
            } : {
              color: 'rgba(148,163,184,0.7)',
              border: '1px solid transparent',
            }}>
            <Icon size={12} />
            {label}
          </button>
        ))}
      </motion.div>

      {/* Notice */}
      <AnimatePresence>
        {notice && (
          <motion.div
            key="notice"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl px-4 py-3 text-xs font-bold"
            style={{
              background: notice.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${notice.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
              color: notice.type === 'success' ? '#10b981' : '#fca5a5',
            }}>
            {notice.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* BUY tab */}
      {tab === 'buy' && (
        <motion.div variants={item} className="space-y-3">
          {/* TON deposit */}
          <div className="glass-card rounded-2xl p-4 space-y-3">
            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.7)' }}>
              Deposit TON
            </p>
            <p className="text-[10px]" style={{ color: 'rgba(148,163,184,0.55)' }}>
              1 TON = {skzPerTon.toLocaleString()} SKZ
            </p>
            <div className="flex gap-2 flex-wrap">
              {TON_PRESETS.map(p => (
                <button key={p} onClick={() => setTonAmount(p)}
                  className="px-3 py-1.5 rounded-xl text-xs font-black transition-all"
                  style={tonAmount === p ? {
                    background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                    color: '#fff',
                  } : {
                    background: 'rgba(14,165,233,0.08)',
                    border: '1px solid rgba(14,165,233,0.2)',
                    color: 'rgba(14,165,233,0.9)',
                  }}>
                  {p} TON
                </button>
              ))}
            </div>
            {!tonIntent ? (
              <button onClick={handleCreateTonIntent} disabled={busy}
                className="w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2"
                style={{
                  background: busy ? 'rgba(14,165,233,0.3)' : 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                  color: '#fff', cursor: busy ? 'wait' : 'pointer',
                  boxShadow: '0 4px 20px rgba(14,165,233,0.25)',
                }}>
                {busy ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} fill="white" />}
                Create Deposit Request · {tonAmount} TON → {(tonAmount * skzPerTon).toLocaleString()} SKZ
              </button>
            ) : (
              <div className="space-y-2 p-3 rounded-xl" style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.2)' }}>
                <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#22d3ee' }}>
                  Send exactly {tonIntent.amountTon} TON to:
                </p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-[11px] text-white truncate flex-1">{tonIntent.depositAddress || 'Not configured'}</p>
                  <button onClick={() => copyToClipboard(tonIntent.depositAddress, 'addr')}
                    className="text-[9px] px-2 py-1 rounded-lg"
                    style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee' }}>
                    {copiedField === 'addr' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-[10px] font-black" style={{ color: '#fbbf24' }}>
                  Memo (required): <span className="font-mono">{tonIntent.memo}</span>
                  <button onClick={() => copyToClipboard(tonIntent.memo, 'memo')}
                    className="ml-2 text-[9px] px-2 py-0.5 rounded-lg"
                    style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}>
                    {copiedField === 'memo' ? 'Copied!' : 'Copy'}
                  </button>
                </p>
                <p className="text-[10px]" style={{ color: 'rgba(148,163,184,0.55)' }}>
                  You'll receive ~{tonIntent.expectedSkz} SKZ after confirmation.
                </p>
                <button onClick={() => setTonIntent(null)} className="text-[10px]" style={{ color: 'rgba(148,163,184,0.5)' }}>
                  Create new request
                </button>
              </div>
            )}
          </div>

          {/* Stars deposit */}
          <div className="glass-card rounded-2xl p-4 space-y-3">
            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.7)' }}>
              Deposit Telegram Stars ⭐
            </p>
            <p className="text-[10px]" style={{ color: 'rgba(148,163,184,0.55)' }}>
              1 Star = {skzPerStar} SKZ
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={starsAmount}
                onChange={e => setStarsAmount(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex-1 rounded-xl px-3 py-2 text-sm font-black text-white bg-transparent outline-none"
                style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' }}
                placeholder="Stars amount"
                min="1"
              />
              <span className="text-[10px]" style={{ color: 'rgba(148,163,184,0.55)' }}>
                → {(starsAmount * skzPerStar).toLocaleString()} SKZ
              </span>
            </div>
            <button onClick={handleStarsInvoice} disabled={busy}
              className="w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2"
              style={{
                background: busy ? 'rgba(234,179,8,0.3)' : 'linear-gradient(135deg, #eab308, #ca8a04)',
                color: '#000', cursor: busy ? 'wait' : 'pointer',
                boxShadow: '0 4px 20px rgba(234,179,8,0.22)',
              }}>
              {busy ? <RefreshCw size={14} className="animate-spin" /> : '⭐'}
              Pay {starsAmount} Stars
            </button>
          </div>
        </motion.div>
      )}

      {/* WITHDRAW tab */}
      {tab === 'withdraw' && (
        <motion.div variants={item} className="glass-card rounded-2xl p-4 space-y-3">
          <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.7)' }}>
            Withdraw as TON
          </p>
          <div className="flex items-center gap-2 p-3 rounded-xl"
            style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
            <Coins size={12} style={{ color: '#10b981' }} />
            <span className="text-xs font-black text-white">{skzBalance.toLocaleString()} SKZ available</span>
          </div>
          <input
            type="number"
            value={scAmount}
            onChange={e => setScAmount(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm font-black text-white bg-transparent outline-none"
            style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' }}
            placeholder="SKZ amount to withdraw"
          />
          <input
            type="text"
            value={tonAddress}
            onChange={e => handleAddressChange(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-xs font-mono text-white bg-transparent outline-none"
            style={{
              border: `1px solid ${addressError ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.12)'}`,
              background: 'rgba(255,255,255,0.04)',
            }}
            placeholder="TON address (UQ… or EQ…)"
          />
          {addressError && (
            <p className="text-[10px]" style={{ color: '#fca5a5' }}>{addressError}</p>
          )}
          <button onClick={handleWithdraw}
            disabled={busy || !scAmount || !!addressError || !tonAddress.trim() || !TON_ADDRESS_RE.test(tonAddress.trim())}
            className="w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.8), rgba(5,150,105,0.8))',
              color: '#fff', cursor: busy ? 'wait' : 'pointer',
              opacity: (!scAmount || !!addressError || !tonAddress.trim() || !TON_ADDRESS_RE.test(tonAddress.trim())) ? 0.4 : 1,
              boxShadow: '0 4px 20px rgba(16,185,129,0.2)',
            }}>
            {busy ? <RefreshCw size={14} className="animate-spin" /> : <ArrowUpRight size={14} />}
            Request Withdrawal
          </button>
        </motion.div>
      )}

      {/* HISTORY tab */}
      {tab === 'history' && (
        <motion.div variants={item} className="space-y-2">
          {ledger.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <p className="text-sm" style={{ color: 'rgba(148,163,184,0.5)' }}>No transactions yet</p>
            </div>
          ) : ledger.map((tx, i) => (
            <div key={tx.id ?? i} className="glass-card rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: (tx.type === 'credit' || tx.type === 'deposit' || tx.type === 'referral_bonus') ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }}>
                <TxIcon type={tx.type} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{tx.description || tx.type}</p>
                {tx.source_bot && (
                  <p className="text-[9px]" style={{ color: 'rgba(148,163,184,0.45)' }}>{tx.source_bot}</p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs font-black font-orbitron"
                  style={{ color: (tx.type === 'credit' || tx.type === 'deposit' || tx.type === 'referral_bonus') ? '#10b981' : '#ef4444' }}>
                  {(tx.type === 'debit') ? '−' : '+'}{Number(tx.amount_sc).toLocaleString()} SKZ
                </p>
                <p className="text-[9px]" style={{ color: 'rgba(148,163,184,0.45)' }}>
                  {formatRelativeTime(tx.created_at)}
                </p>
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
