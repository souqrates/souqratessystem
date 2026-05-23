import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../constants';
import { CircleCheck as CheckCircle, ChevronRight, Loader, Star, TrendingUp, Shield, Users, Zap, Globe, Mail, Send, CircleAlert as AlertCircle, ArrowRight } from 'lucide-react';

const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { headers: { apikey: SUPABASE_CONFIG.anonKey, Authorization: `Bearer ${SUPABASE_CONFIG.anonKey}` } },
});

const PERKS = [
  { icon: TrendingUp, title: 'Earn on Every Win', desc: 'Get commission from every game your referrals win — forever, no cap.', color: '#f59e0b' },
  { icon: Zap, title: 'Infinite Chain', desc: 'Your network cascades deep — earn from players your referrals recruit too.', color: '#22d3ee' },
  { icon: Star, title: 'Custom VIP Rates', desc: 'Top influencers unlock exclusive higher commission rates negotiated directly.', color: '#fbbf24' },
  { icon: Shield, title: 'Real-time Dashboard', desc: 'Track your earnings, referrals, and tier progress live in the app.', color: '#10b981' },
  { icon: Globe, title: 'Global Audience', desc: 'Our platform is available worldwide with Telegram integration.', color: '#a78bfa' },
  { icon: Users, title: '15 Tier Progression', desc: 'The more active players you bring, the higher your tier and commission.', color: '#f97316' },
];

const STATUS_COLORS = { pending: '#f59e0b', reviewing: '#38bdf8', approved: '#10b981', rejected: '#ef4444' };

function FieldInput({ q, value, onChange, error }) {
  const base = {
    width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${error ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.1)'}`,
    borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'Inter, sans-serif',
    transition: 'border-color 0.2s',
  };

  if (q.field_type === 'textarea') {
    return (
      <textarea
        style={{ ...base, padding: '12px 14px', minHeight: 100, resize: 'vertical', lineHeight: 1.6 }}
        placeholder={q.placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={e => e.target.style.borderColor = '#f59e0b60'}
        onBlur={e => e.target.style.borderColor = error ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.1)'}
      />
    );
  }
  if (q.field_type === 'select') {
    const opts = (q.options || '').split(',').map(o => o.trim()).filter(Boolean);
    return (
      <select
        style={{ ...base, padding: '12px 14px', cursor: 'pointer', appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center' }}
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="" style={{ background: '#111', color: '#94a3b8' }}>{q.placeholder || 'Select…'}</option>
        {opts.map(o => <option key={o} value={o} style={{ background: '#111' }}>{o}</option>)}
      </select>
    );
  }
  return (
    <input
      type={q.field_type === 'number' ? 'number' : q.field_type === 'email' ? 'email' : q.field_type === 'url' ? 'url' : 'text'}
      style={{ ...base, padding: '12px 14px' }}
      placeholder={q.placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      onFocus={e => e.target.style.borderColor = '#f59e0b60'}
      onBlur={e => e.target.style.borderColor = error ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.1)'}
    />
  );
}

export default function InfluencerApp() {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers]     = useState({});
  const [errors, setErrors]       = useState({});
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase]         = useState('form'); // 'form' | 'success' | 'error'
  const [errorMsg, setErrorMsg]   = useState('');
  const [activeSection, setActiveSection] = useState('hero'); // 'hero' | 'form'

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('influencer_form_questions')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (Array.isArray(data)) setQuestions(data);
      setLoading(false);
    }
    load();
  }, []);

  function setAnswer(key, val) {
    setAnswers(a => ({ ...a, [key]: val }));
    if (errors[key]) setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  }

  function validate() {
    const errs = {};
    questions.forEach(q => {
      if (q.required && !answers[q.field_key]?.toString().trim()) {
        errs[q.field_key] = 'This field is required';
      }
    });
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      const firstErrKey = Object.keys(errs)[0];
      document.getElementById(`field-${firstErrKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('submit_influencer_form', { p_answers: answers });
      if (error || !data?.ok) {
        setErrorMsg(error?.message || data?.error || 'Submission failed. Please try again.');
        setPhase('error');
      } else {
        setPhase('success');
      }
    } catch (err) {
      setErrorMsg('Network error. Please check your connection and try again.');
      setPhase('error');
    }
    setSubmitting(false);
  }

  if (phase === 'success') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', background: 'linear-gradient(135deg, #07060f 0%, #0d0c1a 50%, #07060f 100%)' }}>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          style={{ maxWidth: 500, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '2px solid rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <CheckCircle size={40} color="#10b981" />
          </div>
          <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 26, fontWeight: 900, color: '#fff', margin: '0 0 12px' }}>Application Received!</h2>
          <p style={{ fontSize: 15, color: 'rgba(148,163,184,0.8)', lineHeight: 1.7, margin: '0 0 32px' }}>
            Thank you for applying to the Souqrates Skillz partner program.<br />
            Our team will review your application and reach out to you within <strong style={{ color: '#f59e0b' }}>2-3 business days</strong>.
          </p>
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: '16px 20px', textAlign: 'left' }}>
            <p style={{ fontSize: 12, color: 'rgba(245,158,11,0.9)', fontWeight: 700, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>What happens next?</p>
            {['Your application is reviewed by our partnerships team', 'We\'ll contact you via the email you provided', 'If approved, you\'ll receive your unique referral link', 'Start earning commission from every win your referrals make'].map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(245,158,11,0.2)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: '#f59e0b', marginTop: 1 }}>{i + 1}</div>
                <p style={{ fontSize: 13, color: 'rgba(203,213,225,0.8)', margin: 0, lineHeight: 1.5 }}>{s}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #07060f 0%, #0d0c1a 50%, #07060f 100%)', fontFamily: 'Inter, sans-serif' }}>
      {/* Ambient orbs */}
      <div style={{ position: 'fixed', top: '-20%', right: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '-20%', left: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,211,238,0.04) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* ─── HERO SECTION ─────────────────────────────────────────── */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 860, margin: '0 auto', padding: '60px 24px 0' }}>
        {/* Logo */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          style={{ textAlign: 'center', marginBottom: 48 }}>
          {/* Circular logo — same style as splash screen */}
          <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto 24px' }}>
            {/* Outer glow ring */}
            <div style={{
              position: 'absolute', inset: -10, borderRadius: '50%',
              boxShadow: '0 0 40px 14px rgba(201,162,39,0.4), 0 0 80px 24px rgba(59,99,255,0.15)',
              animation: 'pulseRing 2.8s ease-in-out infinite',
            }} />
            {/* Gold border ring */}
            <div style={{
              position: 'absolute', inset: -4, borderRadius: '50%',
              background: 'linear-gradient(135deg, #c9a227 0%, #ffd86b 30%, #8b6914 55%, #ffd86b 75%, #c9a227 100%)',
              padding: 4,
            }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#07060f' }} />
            </div>
            {/* Logo image */}
            <img
              src="/WhatsApp_Image_2026-05-20_at_4.16.36_AM.jpeg"
              alt="Souqrates Skillz"
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                borderRadius: '50%', objectFit: 'cover', objectPosition: 'center',
                display: 'block',
              }}
            />
            {/* Inner vignette */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: 'inset 0 0 28px rgba(4,3,10,0.45)', pointerEvents: 'none' }} />
          </div>
          <style>{`
            @keyframes pulseRing {
              0%, 100% { opacity: 0.7; transform: scale(1); }
              50% { opacity: 1; transform: scale(1.04); }
            }
          `}</style>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 100, padding: '6px 16px', marginBottom: 20 }}>
            <Star size={12} color="#f59e0b" fill="#f59e0b" />
            <span style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Influencer Partnership Program</span>
          </div>
          <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(28px, 5vw, 46px)', fontWeight: 900, color: '#fff', margin: '0 0 16px', lineHeight: 1.15 }}>
            Turn Your Audience Into
            <br />
            <span style={{ background: 'linear-gradient(90deg, #f59e0b, #fbbf24, #f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Recurring Revenue
            </span>
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(148,163,184,0.75)', maxWidth: 560, margin: '0 auto 36px', lineHeight: 1.7 }}>
            Partner with Souqrates Skillz and earn commission every time a player from your audience wins. No cap. No expiry. Pure performance-based income.
          </p>
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => {
              setActiveSection('form');
              document.getElementById('apply-form')?.scrollIntoView({ behavior: 'smooth' });
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '14px 32px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#000', fontSize: 15, fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 32px rgba(245,158,11,0.35)' }}>
            Apply Now <ArrowRight size={18} />
          </motion.button>
        </motion.div>

        {/* Stats strip */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 56 }}>
          {[
            { n: '5%+',    label: 'Base Commission',     sub: 'of every prize won' },
            { n: '15',     label: 'Affiliate Tiers',     sub: 'the more you refer, the more you earn' },
            { n: '∞',      label: 'Chain Depth',          sub: 'infinite levels deep' },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i + 0.3 }}
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '20px 16px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(20px, 4vw, 32px)', fontWeight: 900, color: '#f59e0b', marginBottom: 6 }}>{s.n}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.5)' }}>{s.sub}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Perks grid */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(148,163,184,0.4)', textAlign: 'center', marginBottom: 20 }}>Why Partner With Us</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginBottom: 64 }}>
            {PERKS.map((p, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 * i + 0.4 }}
                style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${p.color}18`, borderRadius: 14, padding: '18px 16px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: `${p.color}15`, border: `1px solid ${p.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <p.icon size={18} color={p.color} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>{p.title}</p>
                  <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)', margin: 0, lineHeight: 1.6 }}>{p.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ─── APPLICATION FORM ──────────────────────────────────── */}
        <motion.div id="apply-form" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 100, padding: '6px 16px', marginBottom: 16 }}>
              <Mail size={12} color="#10b981" />
              <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Partnership Application</span>
            </div>
            <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(20px, 3.5vw, 30px)', fontWeight: 900, color: '#fff', margin: '0 0 10px' }}>Apply to Become a Partner</h2>
            <p style={{ fontSize: 14, color: 'rgba(148,163,184,0.6)', margin: 0 }}>Fill in the details below and our team will get back to you within 2-3 business days.</p>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <Loader size={28} color="#f59e0b" style={{ animation: 'spin 1s linear infinite' }} />
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: '32px 28px', marginBottom: 24 }}>
                {phase === 'error' && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '14px 16px', marginBottom: 24 }}>
                    <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                    <p style={{ margin: 0, fontSize: 13, color: '#ef4444', lineHeight: 1.5 }}>{errorMsg}</p>
                  </motion.div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                  {questions.map((q, idx) => {
                    const isWide = q.field_type === 'textarea' || q.field_key === 'bio' || q.field_key === 'extra_notes' || q.field_key === 'past_collabs';
                    return (
                      <motion.div
                        key={q.id}
                        id={`field-${q.field_key}`}
                        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 * idx }}
                        style={{ gridColumn: isWide ? '1 / -1' : 'auto' }}
                      >
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: errors[q.field_key] ? '#ef4444' : 'rgba(148,163,184,0.7)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                          {q.label}
                          {q.required && <span style={{ color: '#f59e0b', marginLeft: 3 }}>*</span>}
                        </label>
                        <FieldInput
                          q={q}
                          value={answers[q.field_key] || ''}
                          onChange={val => setAnswer(q.field_key, val)}
                          error={!!errors[q.field_key]}
                        />
                        <AnimatePresence>
                          {errors[q.field_key] && (
                            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                              style={{ fontSize: 11, color: '#ef4444', margin: '5px 0 0', fontWeight: 600 }}>
                              {errors[q.field_key]}
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={submitting}
                whileHover={submitting ? {} : { scale: 1.02 }}
                whileTap={submitting ? {} : { scale: 0.98 }}
                style={{
                  width: '100%', padding: '16px 32px', borderRadius: 14, border: 'none',
                  background: submitting ? 'rgba(245,158,11,0.3)' : 'linear-gradient(135deg, #f59e0b, #f97316)',
                  color: submitting ? 'rgba(255,255,255,0.4)' : '#000',
                  fontSize: 15, fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  boxShadow: submitting ? 'none' : '0 8px 32px rgba(245,158,11,0.3)',
                  transition: 'all 0.2s',
                }}>
                {submitting ? (
                  <>
                    <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
                    Submitting Application…
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Submit Partnership Application
                  </>
                )}
              </motion.button>

              <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(148,163,184,0.4)', marginTop: 14 }}>
                By submitting, you agree to be contacted by our partnerships team regarding this application.
              </p>
            </form>
          )}
        </motion.div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 60, padding: '32px 0 40px', textAlign: 'center' }}>
          <img src="/WhatsApp_Image_2026-05-20_at_4.16.36_AM.jpeg" alt="Souqrates Skillz" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: '50%', marginBottom: 12, opacity: 0.7, border: '1px solid rgba(201,162,39,0.3)' }} />
          <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.35)', margin: 0 }}>© 2026 Souqrates Skillz · All rights reserved · souqrates.online</p>
        </div>
      </div>
    </div>
  );
}
