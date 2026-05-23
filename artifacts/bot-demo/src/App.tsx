import { useState, useEffect, useRef } from "react";
import "./index.css";

type MessageRole = "bot" | "user";

interface KeyboardButton {
  label: string;
  action: string;
}

interface Message {
  id: number;
  role: MessageRole;
  text?: string;
  card?: "balance";
  keyboard?: KeyboardButton[][];
  time: string;
}

function getTime() {
  return new Date().toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
}

const SCENES: Record<string, { label: string; description: string; action: () => Message[] }> = {
  start: {
    label: "بدء البوت",
    description: "شاهد رسالة الترحيب وقائمة الأوامر",
    action: () => [
      {
        id: Date.now(),
        role: "user",
        text: "/start",
        time: getTime(),
      },
      {
        id: Date.now() + 1,
        role: "bot",
        text: `مرحباً بك في 🌟 البوت الأم\n\nمنصتك المالية الموحدة على تيليغرام.\n\nمحفظتك تعمل عبر جميع البوتات التالية:\n🎮 بوت الألعاب\n🎬 بوت الفيديو\n🎙 الغرف الصوتية\n🤖 الذكاء الاصطناعي\n🛒 المتجر الرقمي\n🏆 بوت المسابقات\n\nاختر ما تريد:`,
        keyboard: [
          [{ label: "👛 محفظتي", action: "wallet" }, { label: "💰 إيداع", action: "deposit" }],
          [{ label: "📤 سحب", action: "withdraw" }, { label: "👥 إحالة", action: "referral" }],
          [{ label: "📊 إحصاءاتي", action: "stats" }, { label: "⚙️ الإعدادات", action: "settings" }],
        ],
        time: getTime(),
      },
    ],
  },
  wallet: {
    label: "المحفظة",
    description: "عرض رصيد المحفظة بجميع العملات",
    action: () => [
      {
        id: Date.now(),
        role: "user",
        text: "👛 محفظتي",
        time: getTime(),
      },
      {
        id: Date.now() + 1,
        role: "bot",
        text: "💼 محفظتك الحالية:",
        card: "balance",
        keyboard: [
          [{ label: "💰 إيداع", action: "deposit" }, { label: "📤 سحب", action: "withdraw" }],
          [{ label: "📋 سجل المعاملات", action: "history" }],
          [{ label: "🔙 القائمة الرئيسية", action: "start" }],
        ],
        time: getTime(),
      },
    ],
  },
  deposit: {
    label: "الإيداع",
    description: "شاهد خيارات الإيداع بالعملات المختلفة",
    action: () => [
      {
        id: Date.now(),
        role: "user",
        text: "💰 إيداع",
        time: getTime(),
      },
      {
        id: Date.now() + 1,
        role: "bot",
        text: `اختر طريقة الإيداع:\n\n⭐ Telegram Stars — للدفع الفوري داخل تيليغرام\n💵 USDT — عبر شبكة TRC20 أو TON\n💎 TON — إيداع مباشر`,
        keyboard: [
          [{ label: "⭐ إيداع Stars", action: "dep_stars" }, { label: "💵 إيداع USDT", action: "dep_usdt" }],
          [{ label: "💎 إيداع TON", action: "dep_ton" }],
          [{ label: "🔙 رجوع", action: "wallet" }],
        ],
        time: getTime(),
      },
    ],
  },
  dep_stars: {
    label: "إيداع Stars",
    description: "إيداع عبر Telegram Stars",
    action: () => [
      {
        id: Date.now(),
        role: "user",
        text: "⭐ إيداع Stars",
        time: getTime(),
      },
      {
        id: Date.now() + 1,
        role: "bot",
        text: `⭐ إيداع Telegram Stars\n\nاختر المبلغ:`,
        keyboard: [
          [{ label: "50 ⭐", action: "pay_50" }, { label: "100 ⭐", action: "pay_100" }, { label: "250 ⭐", action: "pay_250" }],
          [{ label: "500 ⭐", action: "pay_500" }, { label: "1000 ⭐", action: "pay_1000" }],
          [{ label: "🔙 رجوع", action: "deposit" }],
        ],
        time: getTime(),
      },
    ],
  },
  dep_usdt: {
    label: "إيداع USDT",
    description: "إيداع USDT عبر التشفير",
    action: () => [
      {
        id: Date.now(),
        role: "user",
        text: "💵 إيداع USDT",
        time: getTime(),
      },
      {
        id: Date.now() + 1,
        role: "bot",
        text: `💵 إيداع USDT\n\n📋 عنوان المحفظة (TRC20):\n\`TRX9xKmN4pQ8vLs2wYjF7bDcAeR6hZmU1\`\n\nأرسل USDT إلى هذا العنوان وسيظهر الرصيد خلال دقائق.\n\n⚠️ الحد الأدنى: 5 USDT`,
        keyboard: [
          [{ label: "✅ أرسلت المبلغ", action: "sent_usdt" }],
          [{ label: "🔙 رجوع", action: "deposit" }],
        ],
        time: getTime(),
      },
    ],
  },
  withdraw: {
    label: "السحب",
    description: "طلب سحب الأرباح",
    action: () => [
      {
        id: Date.now(),
        role: "user",
        text: "📤 سحب",
        time: getTime(),
      },
      {
        id: Date.now() + 1,
        role: "bot",
        text: `📤 سحب الأرباح\n\nرصيدك القابل للسحب:\n💵 USDT: 12.50\n💎 TON: 0.85\n\nاختر عملة السحب:`,
        keyboard: [
          [{ label: "💵 سحب USDT", action: "wd_usdt" }, { label: "💎 سحب TON", action: "wd_ton" }],
          [{ label: "🔙 رجوع", action: "wallet" }],
        ],
        time: getTime(),
      },
    ],
  },
  wd_usdt: {
    label: "تأكيد السحب",
    description: "إتمام طلب سحب USDT",
    action: () => [
      {
        id: Date.now(),
        role: "user",
        text: "💵 سحب USDT",
        time: getTime(),
      },
      {
        id: Date.now() + 1,
        role: "bot",
        text: `💵 سحب USDT\n\nأرسل عنوان محفظة TRC20 الخاصة بك:`,
        time: getTime(),
      },
      {
        id: Date.now() + 2,
        role: "user",
        text: "TAddr9xKmN4pQ8vAbcXyz123",
        time: getTime(),
      },
      {
        id: Date.now() + 3,
        role: "bot",
        text: `✅ تأكيد السحب\n\nالمبلغ: 12.50 USDT\nرسوم: 1.00 USDT\nصافي السحب: 11.50 USDT\nالعنوان: TAddr9x...z123\n\nهل تؤكد السحب؟`,
        keyboard: [
          [{ label: "✅ تأكيد", action: "wd_confirm" }, { label: "❌ إلغاء", action: "wallet" }],
        ],
        time: getTime(),
      },
    ],
  },
  wd_confirm: {
    label: "تم إرسال طلب السحب",
    description: "رسالة تأكيد الطلب",
    action: () => [
      {
        id: Date.now(),
        role: "user",
        text: "✅ تأكيد",
        time: getTime(),
      },
      {
        id: Date.now() + 1,
        role: "bot",
        text: `✅ تم استلام طلب السحب\n\nسيتم معالجة طلبك خلال 24 ساعة.\nسنرسل لك إشعاراً عند اكتمال التحويل.\n\nرقم الطلب: #4821`,
        keyboard: [
          [{ label: "🔙 القائمة الرئيسية", action: "start" }],
        ],
        time: getTime(),
      },
    ],
  },
  referral: {
    label: "الإحالة",
    description: "نظام الإحالة وكسب العمولات",
    action: () => [
      {
        id: Date.now(),
        role: "user",
        text: "👥 إحالة",
        time: getTime(),
      },
      {
        id: Date.now() + 1,
        role: "bot",
        text: `👥 نظام الإحالة\n\nاكسب 5% من أرباح كل شخص تدعوه!\n\n🔗 رابط الإحالة الخاص بك:\nt.me/MotherBot?start=ref_482917\n\n📊 إحصاءاتك:\n• عدد المُحالين: 3 أشخاص\n• إجمالي الكسب: 2.40 USDT`,
        keyboard: [
          [{ label: "📋 نسخ الرابط", action: "copy_ref" }, { label: "📤 مشاركة", action: "share_ref" }],
          [{ label: "🔙 رجوع", action: "start" }],
        ],
        time: getTime(),
      },
    ],
  },
  stats: {
    label: "إحصاءاتي",
    description: "إجمالي الأرباح والنشاط",
    action: () => [
      {
        id: Date.now(),
        role: "user",
        text: "📊 إحصاءاتي",
        time: getTime(),
      },
      {
        id: Date.now() + 1,
        role: "bot",
        text: `📊 إحصاءاتك الشاملة\n\n💰 إجمالي الأرباح:\n  USDT: 47.80\n  Stars: 1,200 ⭐\n  TON: 3.25\n\n🎮 الألعاب: 22 لعبة\n🎬 الفيديو: 8 مقاطع\n🏆 المسابقات: 5 مشاركات\n\n🔗 إحالات: 3 أشخاص → 2.40 USDT`,
        keyboard: [
          [{ label: "🔙 القائمة الرئيسية", action: "start" }],
        ],
        time: getTime(),
      },
    ],
  },
};

const QUICK_SCENES = [
  { key: "start", label: "🏠 البداية" },
  { key: "wallet", label: "👛 المحفظة" },
  { key: "deposit", label: "💰 إيداع" },
  { key: "dep_stars", label: "⭐ Stars" },
  { key: "dep_usdt", label: "💵 USDT" },
  { key: "withdraw", label: "📤 سحب" },
  { key: "wd_usdt", label: "💵 إتمام السحب" },
  { key: "wd_confirm", label: "✅ تأكيد السحب" },
  { key: "referral", label: "👥 إحالة" },
  { key: "stats", label: "📊 إحصاءات" },
];

function BalanceCard() {
  return (
    <div className="balance-card">
      <div className="balance-row">
        <span className="balance-label">💵 USDT</span>
        <span className="balance-value usdt">12.500000</span>
      </div>
      <div className="balance-row">
        <span className="balance-label">⭐ Stars</span>
        <span className="balance-value stars">1,200</span>
      </div>
      <div className="balance-row">
        <span className="balance-label">💎 TON</span>
        <span className="balance-value ton">0.850000000</span>
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: 8, paddingTop: 8 }}>
        <div className="balance-row">
          <span className="balance-label">📈 إجمالي المكاسب</span>
          <span className="balance-value" style={{ fontSize: 13, color: "#6c8499" }}>47.80 USDT</span>
        </div>
      </div>
    </div>
  );
}

let msgCounter = 100;

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  const [inputText, setInputText] = useState("");
  const [currentScene, setCurrentScene] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const addMessages = async (newMsgs: Message[]) => {
    for (let i = 0; i < newMsgs.length; i++) {
      const msg = newMsgs[i];
      if (msg.role === "user") {
        setMessages((prev) => [...prev, { ...msg, id: ++msgCounter }]);
        await delay(300);
      } else {
        setTyping(true);
        await delay(600 + msg.text!.length * 8);
        setTyping(false);
        setMessages((prev) => [...prev, { ...msg, id: ++msgCounter }]);
        if (i < newMsgs.length - 1) await delay(200);
      }
    }
  };

  const handleAction = (action: string) => {
    const scene = SCENES[action];
    if (!scene) return;
    setCurrentScene(action);
    addMessages(scene.action());
  };

  const handleSend = () => {
    if (!inputText.trim()) return;
    const userMsg: Message = {
      id: ++msgCounter,
      role: "user",
      text: inputText.trim(),
      time: getTime(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");

    setTimeout(() => {
      const botReply: Message = {
        id: ++msgCounter,
        role: "bot",
        text: "عذراً، هذه محاكاة تجريبية. استخدم الأزرار أدناه للتنقل.",
        keyboard: [
          [{ label: "🏠 القائمة الرئيسية", action: "start" }],
        ],
        time: getTime(),
      };
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        setMessages((prev) => [...prev, botReply]);
      }, 800);
    }, 300);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 32, height: "100vh", padding: 20 }}>
      <div className="instruction-panel">
        <div>
          <div className="scene-label">محاكاة البوت الأم</div>
          <div className="instruction-title" style={{ marginTop: 8 }}>ما يراه المستخدم</div>
          <div className="instruction-subtitle" style={{ marginTop: 8 }}>
            هذه محاكاة تفاعلية لواجهة البوت الأم على تيليغرام.
            انقر على أي سيناريو لمشاهدته.
          </div>
        </div>

        <div className="quick-btns">
          {QUICK_SCENES.map((s) => (
            <button
              key={s.key}
              className="quick-btn"
              style={currentScene === s.key ? {
                background: "rgba(82, 136, 193, 0.3)",
                borderColor: "rgba(82, 136, 193, 0.6)",
              } : {}}
              onClick={() => handleAction(s.key)}
            >
              {s.label}
              <span style={{ marginRight: 8, fontSize: 11, color: "#4a6480" }}>
                — {SCENES[s.key]?.description}
              </span>
            </button>
          ))}
        </div>

        <div className="step-list">
          <div className="step-item">
            <div className="step-num">1</div>
            <div className="step-text">البوت الحقيقي يعمل عبر تيليغرام بعد إضافة توكن البوت</div>
          </div>
          <div className="step-item">
            <div className="step-num">2</div>
            <div className="step-text">كل بوت فرعي يتصل بالبوت الأم مالياً عبر API key</div>
          </div>
          <div className="step-item">
            <div className="step-num">3</div>
            <div className="step-text">المحفظة موحدة — المستخدم يكسب من جميع البوتات في نفس المحفظة</div>
          </div>
        </div>
      </div>

      <div className="phone-frame">
        <div className="status-bar">
          <span>9:41</span>
          <span>●●● 5G</span>
        </div>

        <div className="chat-header">
          <div className="bot-avatar">🌟</div>
          <div className="chat-header-info">
            <h3>البوت الأم</h3>
            <p>متصل الآن</p>
          </div>
        </div>

        <div className="messages-area">
          {messages.length === 0 && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#4a6480", fontSize: 13, textAlign: "center", padding: 20 }}>
              اختر سيناريو من القائمة اليسرى<br />لمشاهدة تجربة المستخدم
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`message ${msg.role}`}>
              <div className={`bubble ${msg.role}`}>
                {msg.text}
                {msg.card === "balance" && <BalanceCard />}
              </div>
              {msg.keyboard && (
                <div className="keyboard">
                  {msg.keyboard.map((row, ri) => (
                    <div key={ri} className="keyboard-row">
                      {row.map((btn, bi) => (
                        <button
                          key={bi}
                          className="kb-btn"
                          onClick={() => handleAction(btn.action)}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              <div className="bubble-time">{msg.time}</div>
            </div>
          ))}

          {typing && (
            <div className="typing-indicator">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="input-area">
          <input
            className="chat-input"
            placeholder="اكتب رسالة..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            dir="rtl"
          />
          <button className="send-btn" onClick={handleSend}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
