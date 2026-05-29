import { useState } from "react";
import { TicketResult, sha256Hex, deriveOutcome } from "../lib/provablyFair";

interface Props {
  ticket: TicketResult;
  symbols: string[];
  gridSize: number;
  onClose: () => void;
}

type VerifyState =
  | null
  | { step: "hashing" }
  | {
      step: "done";
      hashMatch: boolean;
      outcomeMatch: boolean;
      computedHash: string;
      recomputedOutcome: string[];
    };

export default function FairVerifier({ ticket, symbols, gridSize, onClose }: Props) {
  const [customServer, setCustomServer] = useState(ticket.serverSeed);
  const [customClient, setCustomClient] = useState(ticket.clientSeed);
  const [customNonce, setCustomNonce] = useState(String(ticket.nonce));
  const [verifyState, setVerifyState] = useState<VerifyState>(null);
  const [verifying, setVerifying] = useState(false);

  async function handleVerify() {
    setVerifying(true);
    setVerifyState({ step: "hashing" });
    try {
      // Step 1: verify hash
      const computedHash = await sha256Hex(customServer);
      const hashMatch = computedHash === ticket.serverSeedHash;

      // Step 2: recompute outcome from seeds
      const nonceVal = parseInt(customNonce, 10) || 0;
      const recomputedOutcome = deriveOutcome(customServer, customClient, nonceVal, symbols, gridSize);

      // Step 3: compare outcome arrays
      const outcomeMatch =
        recomputedOutcome.length === ticket.outcome.length &&
        recomputedOutcome.every((sym, i) => sym === ticket.outcome[i]);

      setVerifyState({
        step: "done",
        hashMatch,
        outcomeMatch,
        computedHash,
        recomputedOutcome,
      });
    } finally {
      setVerifying(false);
    }
  }

  const fullyVerified =
    verifyState?.step === "done" && verifyState.hashMatch && verifyState.outcomeMatch;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}>
      <div className="w-full max-w-lg rounded-t-3xl p-5 overflow-y-auto"
        style={{ background: "#0d0a1e", border: "1px solid rgba(255,255,255,0.1)", maxHeight: "88vh" }}>

        {/* Handle */}
        <div className="flex justify-center mb-4">
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
        </div>

        {/* Title */}
        <div className="flex items-center gap-2 mb-5">
          <span className="text-2xl">🔐</span>
          <div className="flex-1">
            <div className="font-orbitron font-black text-base text-white">Provably Fair</div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>تحقق بنفسك من نتيجة ورقتك</div>
          </div>
          <button onClick={onClose} className="btn-ghost px-3 py-1.5 text-xs">إغلاق</button>
        </div>

        {/* How it works */}
        <div className="rounded-2xl p-4 mb-4"
          style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}>
          <div className="font-bold text-xs mb-2" style={{ color: "#10b981" }}>كيف يعمل؟</div>
          <ol className="text-xs leading-relaxed list-decimal list-inside space-y-1"
            style={{ color: "rgba(255,255,255,0.6)" }}>
            <li>قبل اللعب: نولّد <strong style={{ color: "#f59e0b" }}>Server Seed</strong> عشوائياً ونكشف <strong style={{ color: "#f59e0b" }}>Hash</strong> فقط</li>
            <li>بعد الكشف: نكشف البذرة الأصلية — تحقق أن SHA-256 مطابق</li>
            <li>أعِد حساب النتيجة من البذرتين والـ Nonce — يجب أن تطابق ما رأيته</li>
          </ol>
        </div>

        {/* Seeds display */}
        <div className="flex flex-col gap-2 mb-4">
          <SeedRow label="Server Seed Hash (قبل اللعب)" value={ticket.serverSeedHash} color="#f59e0b" />
          <SeedRow label="Server Seed (بعد اللعب)" value={ticket.serverSeed} color="#10b981" />
          <SeedRow label="Client Seed" value={ticket.clientSeed} color="#8b5cf6" />
          <div className="flex justify-between items-center px-3 py-2.5 rounded-xl"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>Nonce</span>
            <span className="font-orbitron text-sm text-white">{ticket.nonce}</span>
          </div>
        </div>

        {/* Original outcome */}
        <div className="rounded-2xl p-3 mb-4"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="section-label mb-2">النتيجة الأصلية</div>
          <div className="flex flex-wrap gap-1.5">
            {ticket.outcome.map((sym, i) => (
              <span key={i} className="text-xl w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                {sym}
              </span>
            ))}
          </div>
        </div>

        {/* Manual verifier */}
        <div className="rounded-2xl p-4 mb-4"
          style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.18)" }}>
          <div className="font-bold text-sm text-white mb-3">حاسبة التحقق المستقلة</div>

          <div className="flex flex-col gap-2 mb-3">
            <InputRow
              label="Server Seed"
              value={customServer}
              onChange={(v) => { setCustomServer(v); setVerifyState(null); }}
            />
            <InputRow
              label="Client Seed"
              value={customClient}
              onChange={(v) => { setCustomClient(v); setVerifyState(null); }}
            />
            <InputRow
              label="Nonce"
              value={customNonce}
              onChange={(v) => { setCustomNonce(v); setVerifyState(null); }}
              type="number"
            />
          </div>

          <button
            onClick={handleVerify}
            disabled={verifying || !customServer || !customClient}
            className="btn-purple w-full py-2.5 text-sm font-bold"
            style={{ opacity: (!customServer || !customClient) ? 0.5 : 1 }}
          >
            {verifying ? "⏳ جاري التحقق..." : "احسب وقارن النتيجة"}
          </button>

          {/* Results */}
          {verifyState?.step === "done" && (
            <div className="mt-3 flex flex-col gap-2">
              {/* Hash check */}
              <ResultBadge
                ok={verifyState.hashMatch}
                okText="✅ SHA-256 مطابق — البذرة صحيحة"
                failText="❌ SHA-256 غير مطابق — البذرة غير صحيحة"
                detail={`Hash: ${verifyState.computedHash.slice(0, 32)}…`}
              />

              {/* Outcome check */}
              <ResultBadge
                ok={verifyState.outcomeMatch}
                okText="✅ النتيجة مطابقة — لا تلاعب!"
                failText="❌ النتيجة غير مطابقة"
                detail={null}
              />

              {/* Recomputed outcome */}
              {verifyState.recomputedOutcome.length > 0 && (
                <div className="rounded-xl p-3"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="section-label mb-2">النتيجة المُعاد حسابها</div>
                  <div className="flex flex-wrap gap-1">
                    {verifyState.recomputedOutcome.map((sym, i) => (
                      <span key={i} className="text-lg w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{
                          background: sym === ticket.outcome[i]
                            ? "rgba(16,185,129,0.15)"
                            : "rgba(239,68,68,0.15)",
                          border: `1px solid ${sym === ticket.outcome[i]
                            ? "rgba(16,185,129,0.3)"
                            : "rgba(239,68,68,0.3)"}`,
                        }}>
                        {sym}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {fullyVerified && (
                <div className="text-center text-xs font-bold py-2"
                  style={{ color: "#10b981" }}>
                  🔐 هذا البوت لا يتلاعب بالنتائج — التحقق اكتمل
                </div>
              )}
            </div>
          )}
        </div>

        <button onClick={onClose} className="btn-ghost w-full py-3 font-bold">إغلاق</button>
      </div>
    </div>
  );
}

function SeedRow({ label, value, color }: { label: string; value: string; color: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="rounded-xl p-3"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-bold" style={{ color }}>{label}</span>
        <button onClick={copy} className="text-xs px-2 py-0.5 rounded-lg"
          style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)", border: "none", cursor: "pointer" }}>
          {copied ? "✓" : "نسخ"}
        </button>
      </div>
      <div className="text-xs break-all" style={{ color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}>
        {value}
      </div>
    </div>
  );
}

function InputRow({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-xs px-3 py-2 rounded-xl"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "white",
          fontFamily: "monospace",
          outline: "none",
        }}
        dir="ltr"
      />
    </div>
  );
}

function ResultBadge({
  ok,
  okText,
  failText,
  detail,
}: {
  ok: boolean;
  okText: string;
  failText: string;
  detail: string | null;
}) {
  return (
    <div className="rounded-xl p-3"
      style={{
        background: ok ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
        border: `1px solid ${ok ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
      }}>
      <div className="font-bold text-sm" style={{ color: ok ? "#10b981" : "#ef4444" }}>
        {ok ? okText : failText}
      </div>
      {detail && (
        <div className="text-xs mt-1 break-all" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>
          {detail}
        </div>
      )}
    </div>
  );
}
