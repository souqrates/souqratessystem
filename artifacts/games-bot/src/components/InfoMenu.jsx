import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ChevronRight, ChevronLeft, Shield, Coins, Download, Upload, Scale, BookOpen, CircleHelp as HelpCircle, MessageCircle, Gamepad2, ArrowDownLeft, ArrowUpRight, ShieldCheck, ScrollText, FileText, Phone, Mail, Send, CircleCheck as CheckCircle, CircleAlert as AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getSessionId } from '../lib/session';
import useAppStore from '../store/appStore';
import { t } from '../lib/i18n';

const LUCIDE_ICONS = {
  Shield, Coins, Download, Upload, Scale, BookOpen, HelpCircle,
  MessageCircle, Gamepad2, ArrowDownLeft, ArrowUpRight, ShieldCheck,
  ScrollText, FileText,
};

const ACCENT_MAP = {
  terms: '#00d4ff',
  privacy: '#06b6d4',
  'how-to-play': '#10b981',
  deposits: '#f59e0b',
  withdrawals: '#f97316',
  currency: '#22d3ee',
  'fair-play': '#10b981',
  faq: '#00d4ff',
};

function getIcon(iconName) {
  return LUCIDE_ICONS[iconName] || BookOpen;
}

function getAccent(slug) {
  return ACCENT_MAP[slug] || '#00d4ff';
}

export default function InfoMenu() {
  const { language } = useAppStore();
  const [open, setOpen] = useState(false);
  const [pages, setPages] = useState([]);
  const [activePage, setActivePage] = useState(null);
  const [showContact, setShowContact] = useState(false);
  const [contactInfo, setContactInfo] = useState({ whatsapp: '', telegram: '', email: '' });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open || loaded) return;
    (async () => {
      const [pagesRes, waRes, tgRes, emailRes] = await Promise.all([
        supabase.rpc('info_get_pages'),
        supabase.from('manager_config').select('value').eq('key', 'contact_whatsapp').maybeSingle(),
        supabase.from('manager_config').select('value').eq('key', 'contact_telegram').maybeSingle(),
        supabase.from('manager_config').select('value').eq('key', 'contact_email').maybeSingle(),
      ]);
      if (Array.isArray(pagesRes.data)) setPages(pagesRes.data);
      setContactInfo({
        whatsapp: waRes.data?.value || '',
        telegram: tgRes.data?.value || '',
        email:    emailRes.data?.value || '',
      });
      setLoaded(true);
    })();
  }, [open, loaded]);

  function close() {
    setOpen(false);
    setTimeout(() => { setActivePage(null); setShowContact(false); }, 300);
  }

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(true)}
        className="flex items-center justify-center"
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          background: 'rgba(0,212,255,0.08)',
          border: '1px solid rgba(0,212,255,0.2)',
          cursor: 'pointer',
        }}
      >
        <Menu size={18} color="#00d4ff" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={close}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.7)',
                zIndex: 200,
                backdropFilter: 'blur(4px)',
              }}
            />

            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 32 }}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                bottom: 0,
                width: '88%',
                maxWidth: 380,
                zIndex: 201,
                background: 'linear-gradient(180deg, #070414 0%, #04030a 100%)',
                borderRight: '1px solid rgba(0,212,255,0.12)',
                boxShadow: '8px 0 40px rgba(0,0,0,0.8)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: '16px 18px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexShrink: 0,
                }}
              >
                <div>
                  <p
                    style={{
                      fontFamily: 'Orbitron, sans-serif',
                      fontWeight: 900,
                      fontSize: 14,
                      color: '#fff',
                      margin: 0,
                      letterSpacing: '0.14em',
                    }}
                  >
                    SOUQRATES SKILLZ
                  </p>
                  <p
                    style={{
                      fontSize: 10,
                      color: 'rgba(0,212,255,0.7)',
                      fontWeight: 600,
                      margin: '3px 0 0',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Info & Legal
                  </p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={close}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={16} color="rgba(148,163,184,0.7)" />
                </motion.button>
              </div>

              {/* Content area */}
              <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                <AnimatePresence mode="wait">
                  {showContact ? (
                    <motion.div
                      key="contact"
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 30 }}
                      transition={{ duration: 0.18 }}
                      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                    >
                      <ContactPanel
                        contactInfo={contactInfo}
                        onBack={() => setShowContact(false)}
                      />
                    </motion.div>
                  ) : !activePage ? (
                    <motion.div
                      key="list"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.18 }}
                      style={{
                        height: '100%',
                        overflowY: 'auto',
                        padding: '12px 14px',
                      }}
                    >
                      {!loaded ? (
                        <div style={{ padding: 40, textAlign: 'center' }}>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            style={{
                              width: 28,
                              height: 28,
                              border: '2px solid rgba(0,212,255,0.15)',
                              borderTop: '2px solid #00d4ff',
                              borderRadius: '50%',
                              margin: '0 auto',
                            }}
                          />
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {pages.map((p, i) => {
                            const Icon = getIcon(p.icon);
                            const accent = getAccent(p.slug);
                            return (
                              <motion.button
                                key={p.slug}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.04 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => setActivePage(p)}
                                style={{
                                  width: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 12,
                                  padding: '14px 14px',
                                  borderRadius: 14,
                                  border: `1px solid ${accent}18`,
                                  background: `linear-gradient(135deg, ${accent}08, transparent)`,
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                }}
                              >
                                <div
                                  style={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: 12,
                                    background: `${accent}12`,
                                    border: `1px solid ${accent}25`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                  }}
                                >
                                  <Icon size={17} color={accent} />
                                </div>
                                <p
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: '#fff',
                                    margin: 0,
                                    flex: 1,
                                    lineHeight: 1.3,
                                  }}
                                >
                                  {p.title}
                                </p>
                                <ChevronRight size={14} color="rgba(148,163,184,0.3)" />
                              </motion.button>
                            );
                          })}

                          {/* Contact Us button */}
                          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '6px 0' }} />
                          <motion.button
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: pages.length * 0.04 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => setShowContact(true)}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: '14px 14px',
                              borderRadius: 14,
                              border: '1px solid rgba(16,185,129,0.18)',
                              background: 'linear-gradient(135deg, rgba(16,185,129,0.08), transparent)',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <div style={{
                              width: 38, height: 38, borderRadius: 12,
                              background: 'rgba(16,185,129,0.12)',
                              border: '1px solid rgba(16,185,129,0.25)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}>
                              <MessageCircle size={17} color="#10b981" />
                            </div>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0, flex: 1 }}>
                              Contact Us
                            </p>
                            <ChevronRight size={14} color="rgba(148,163,184,0.3)" />
                          </motion.button>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="detail"
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 30 }}
                      transition={{ duration: 0.18 }}
                      style={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <PageDetail page={activePage} onBack={() => setActivePage(null)} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div
                style={{
                  padding: '12px 18px',
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                  flexShrink: 0,
                }}
              >
                <p
                  style={{
                    fontSize: 9,
                    color: 'rgba(148,163,184,0.3)',
                    textAlign: 'center',
                    margin: 0,
                    letterSpacing: '0.06em',
                  }}
                >
                  Souqrates Skillz -- All rights reserved
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function PageDetail({ page, onBack }) {
  const accent = getAccent(page.slug);
  const Icon = getIcon(page.icon);

  return (
    <>
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
          background: `linear-gradient(135deg, ${accent}08, transparent)`,
        }}
      >
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={onBack}
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <ChevronLeft size={16} color="rgba(148,163,184,0.7)" />
        </motion.button>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: `${accent}15`,
            border: `1px solid ${accent}30`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={15} color={accent} />
        </div>
        <p
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: '#fff',
            margin: 0,
            flex: 1,
            lineHeight: 1.3,
          }}
        >
          {page.title}
        </p>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '18px 18px 28px',
        }}
      >
        <InfoContent content={page.content} accent={accent} language={language} />
      </div>
    </>
  );
}

function InfoContent({ content, accent, language }) {
  if (!content) {
    return (
      <p style={{ color: 'rgba(148,163,184,0.4)', fontSize: 13 }}>
        {t(language, 'noContent')}
      </p>
    );
  }

  const lines = content.split('\n');
  const elements = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      elements.push(<div key={i} style={{ height: 8 }} />);
      continue;
    }

    if (trimmed.startsWith('## ')) {
      elements.push(
        <h3
          key={i}
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: accent,
            margin: '18px 0 8px',
            letterSpacing: '0.02em',
            lineHeight: 1.4,
          }}
        >
          {trimmed.slice(3)}
        </h3>
      );
    } else if (trimmed.startsWith('# ')) {
      elements.push(
        <h2
          key={i}
          style={{
            fontSize: 16,
            fontWeight: 900,
            color: '#fff',
            margin: '20px 0 10px',
            letterSpacing: '0.02em',
            lineHeight: 1.3,
          }}
        >
          {trimmed.slice(2)}
        </h2>
      );
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <span style={{ color: accent, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>&#8226;</span>
          <p style={{ fontSize: 12, lineHeight: 1.65, color: 'rgba(226,232,240,0.75)', margin: 0 }}>
            {renderInline(trimmed.slice(2))}
          </p>
        </div>
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      const numEnd = trimmed.indexOf('. ');
      const num = trimmed.slice(0, numEnd);
      const text = trimmed.slice(numEnd + 2);
      elements.push(
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <span style={{ color: accent, fontWeight: 800, fontSize: 11, minWidth: 18, flexShrink: 0, marginTop: 1 }}>
            {num}.
          </span>
          <p style={{ fontSize: 12, lineHeight: 1.65, color: 'rgba(226,232,240,0.75)', margin: 0 }}>
            {renderInline(text)}
          </p>
        </div>
      );
    } else if (trimmed.startsWith('> ')) {
      elements.push(
        <div
          key={i}
          style={{
            borderLeft: `3px solid ${accent}60`,
            margin: '8px 0',
            background: `${accent}06`,
            borderRadius: '0 8px 8px 0',
            padding: '10px 14px',
          }}
        >
          <p style={{ fontSize: 12, lineHeight: 1.65, color: 'rgba(226,232,240,0.8)', margin: 0, fontStyle: 'italic' }}>
            {renderInline(trimmed.slice(2))}
          </p>
        </div>
      );
    } else if (trimmed === '---') {
      elements.push(
        <hr key={i} style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)', margin: '16px 0' }} />
      );
    } else {
      elements.push(
        <p key={i} style={{ fontSize: 12, lineHeight: 1.7, color: 'rgba(226,232,240,0.7)', margin: '0 0 6px' }}>
          {renderInline(trimmed)}
        </p>
      );
    }
  }

  return <>{elements}</>;
}

function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} style={{ color: '#fff', fontWeight: 700 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function ContactPanel({ contactInfo, onBack }) {
  const [form, setForm] = useState({ name: '', email: '', subject: '', body: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [errMsg, setErrMsg] = useState('');

  const hasAnyContact = contactInfo.whatsapp || contactInfo.telegram || contactInfo.email;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.body.trim() || form.body.trim().length < 5) {
      setErrMsg('Please write your message (at least 5 characters).');
      return;
    }
    setStatus('sending'); setErrMsg('');
    try {
      const sid = await getSessionId();
      const { data, error } = await supabase.rpc('submit_contact_message', {
        p_session_id: sid || '',
        p_name:       form.name,
        p_email:      form.email,
        p_subject:    form.subject,
        p_body:       form.body,
      });
      if (error || !data?.ok) throw new Error(data?.error || 'failed');
      setStatus('sent');
    } catch {
      setStatus('error');
      setErrMsg('Failed to send. Please try again.');
    }
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    padding: '10px 12px',
    background: 'rgba(0,0,0,0.35)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    color: '#fff', fontSize: 13, outline: 'none',
    fontFamily: 'inherit',
  };

  return (
    <>
      {/* Header */}
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        background: 'linear-gradient(135deg, rgba(16,185,129,0.08), transparent)',
      }}>
        <motion.button whileTap={{ scale: 0.85 }} onClick={onBack}
          style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ChevronLeft size={16} color="rgba(148,163,184,0.7)" />
        </motion.button>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <MessageCircle size={15} color="#10b981" />
        </div>
        <p style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: 0, flex: 1 }}>Contact Us</p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 24px' }}>

        {/* Contact channels */}
        {hasAnyContact && (
          <div style={{ marginBottom: 18 }}>
            <p style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(148,163,184,0.45)', margin: '0 0 10px' }}>
              Reach us directly
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {contactInfo.whatsapp && (
                <a href={`https://wa.me/${contactInfo.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: 'rgba(37,211,102,0.07)', border: '1px solid rgba(37,211,102,0.18)', textDecoration: 'none' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(37,211,102,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Phone size={16} color="#25D366" />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 9, color: 'rgba(148,163,184,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>WhatsApp</p>
                    <p style={{ margin: 0, fontSize: 13, color: '#25D366', fontWeight: 700 }}>{contactInfo.whatsapp}</p>
                  </div>
                </a>
              )}
              {contactInfo.telegram && (
                <a href={`https://t.me/${contactInfo.telegram.replace('@', '')}`} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: 'rgba(41,182,246,0.07)', border: '1px solid rgba(41,182,246,0.18)', textDecoration: 'none' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(41,182,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Send size={16} color="#29b6f6" />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 9, color: 'rgba(148,163,184,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Telegram</p>
                    <p style={{ margin: 0, fontSize: 13, color: '#29b6f6', fontWeight: 700 }}>{contactInfo.telegram.startsWith('@') ? contactInfo.telegram : `@${contactInfo.telegram}`}</p>
                  </div>
                </a>
              )}
              {contactInfo.email && (
                <a href={`mailto:${contactInfo.email}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.18)', textDecoration: 'none' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(249,115,22,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Mail size={16} color="#f97316" />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 9, color: 'rgba(148,163,184,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Email</p>
                    <p style={{ margin: 0, fontSize: 13, color: '#f97316', fontWeight: 700 }}>{contactInfo.email}</p>
                  </div>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Message form */}
        <p style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(148,163,184,0.45)', margin: '0 0 10px' }}>
          Send us a message
        </p>

        {status === 'sent' ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: 'center', padding: '28px 16px', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 14 }}>
            <CheckCircle size={36} color="#10b981" style={{ marginBottom: 10 }} />
            <p style={{ fontSize: 14, fontWeight: 800, color: '#10b981', margin: '0 0 6px' }}>Message Sent!</p>
            <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.6)', margin: 0, lineHeight: 1.6 }}>
              We received your message and will get back to you soon.
            </p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.45)', margin: '0 0 4px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Your Name</p>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Optional" style={inputStyle} />
              </div>
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.45)', margin: '0 0 4px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Email</p>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="Optional" style={inputStyle} />
              </div>
            </div>
            <div>
              <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.45)', margin: '0 0 4px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Subject</p>
              <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="e.g. Payment issue, Game bug..." style={inputStyle} />
            </div>
            <div>
              <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.45)', margin: '0 0 4px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Message <span style={{ color: '#ef4444' }}>*</span></p>
              <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                placeholder="Describe your issue or question..."
                rows={4}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 90, lineHeight: 1.6 }} />
            </div>

            {errMsg && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8 }}>
                <AlertCircle size={13} color="#ef4444" />
                <p style={{ margin: 0, fontSize: 11, color: '#ef4444' }}>{errMsg}</p>
              </div>
            )}

            <motion.button
              type="submit"
              whileTap={{ scale: 0.97 }}
              disabled={status === 'sending'}
              style={{
                width: '100%', padding: '12px', borderRadius: 12, border: 'none', cursor: status === 'sending' ? 'not-allowed' : 'pointer',
                background: status === 'sending' ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.85)',
                color: '#fff', fontSize: 13, fontWeight: 800, letterSpacing: '0.04em',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {status === 'sending' ? (
                <>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%' }} />
                  Sending...
                </>
              ) : (
                <><Send size={14} /> Send Message</>
              )}
            </motion.button>
          </form>
        )}
      </div>
    </>
  );
}
