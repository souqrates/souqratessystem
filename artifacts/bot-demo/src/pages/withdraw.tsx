import { useState } from "react";
import { MOCK_BALANCES } from "../lib/mock-data";
import { usePlatformSettings } from "../lib/use-platform-settings";
import { Zap, AlertCircle } from "lucide-react";

type Target = "usdt" | "ton";

export function Withdraw() {
  const [target, setTarget] = useState<Target>("usdt");
  const [skzAmount, setSkzAmount] = useState("");
  const [address, setAddress] = useState("");
  const { settings } = usePlatformSettings();

  const getRate = () => target === "usdt" ? settings.skzPerUsdt : settings.skzPerTon;
  const feePercent = target === "usdt"
    ? parseFloat(settings.withdrawalFeeUsdtPercent) / 100
    : parseFloat(settings.withdrawalFeeTonPercent) / 100;
  const maxSkz = MOCK_BALANCES.skz;
  const minSkz = parseFloat(settings.minWithdrawalSkz);
  const numSkz = parseFloat(skzAmount || "0");
  const isOverMax = numSkz > maxSkz;
  const isBelowMin = numSkz > 0 && numSkz < minSkz;
  const realAmount = numSkz / getRate();
  const fee = realAmount * feePercent;
  const feeSkz = fee * getRate();
  const netReal = Math.max(0, realAmount - fee);
  const isValid = numSkz >= minSkz && !isOverMax && address.length > 10;

  return (
    <div className="p-4 space-y-5 pb-24">
      <h1 className="text-2xl font-bold mt-2">سحب SKZ</h1>

      {/* SKZ Balance Banner */}
      <div className="glass-card-skz rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-skz to-skz-dark flex items-center justify-center skz-coin">
            <span className="text-white font-black text-sm">S</span>
          </div>
          <div>
            <p className="text-xs text-white/50">رصيد SKZ المتاح</p>
            <p className="font-black text-xl gradient-text">{maxSkz.toLocaleString("ar")}</p>
          </div>
        </div>
        <p className="text-xs text-white/30">≈ ${(maxSkz / settings.skzPerUsdt).toFixed(2)}</p>
      </div>

      {/* Target Currency */}
      <div>
        <p className="text-xs font-bold text-white/40 mb-2 px-1">تحويل إلى</p>
        <div className="grid grid-cols-2 gap-2">
          {([
            { id: "usdt" as Target, label: "USDT", sub: `${settings.skzPerUsdt} SKZ = 1 USDT`, border: "border-usdt", bg: "bg-usdt/10" },
            { id: "ton" as Target, label: "TON", sub: `${settings.skzPerTon} SKZ = 1 TON`, border: "border-ton", bg: "bg-ton/10" },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setTarget(t.id)}
              className={`p-4 rounded-2xl border-2 transition-all text-left ${target === t.id ? `${t.border} ${t.bg}` : "border-white/5 glass-card"}`}
            >
              <p className="font-bold">{t.label}</p>
              <p className="text-[10px] text-white/40 mt-0.5">{t.sub}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Amount in SKZ */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-xs font-bold text-white/40">المبلغ بـ SKZ</label>
          <button
            onClick={() => setSkzAmount(maxSkz.toString())}
            className="text-[10px] font-bold text-skz-light bg-skz/10 px-2 py-1 rounded-lg"
          >
            الكل ({maxSkz.toLocaleString()})
          </button>
        </div>
        <div className="relative">
          <input
            type="number"
            value={skzAmount}
            onChange={(e) => setSkzAmount(e.target.value)}
            placeholder="0"
            className="w-full glass-card rounded-2xl px-4 py-4 text-2xl font-black bg-transparent outline-none focus:border-skz transition-colors text-right border border-white/10"
            dir="ltr"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
            <Zap size={18} className="text-skz-light" />
          </div>
        </div>
        {isOverMax && (
          <p className="text-xs text-danger flex items-center gap-1">
            <AlertCircle size={12} /> المبلغ يتجاوز الرصيد المتاح
          </p>
        )}
        {isBelowMin && (
          <p className="text-xs text-danger flex items-center gap-1">
            <AlertCircle size={12} /> الحد الأدنى للسحب: {minSkz.toLocaleString()} SKZ
          </p>
        )}
      </div>

      {/* Wallet Address */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-white/40">
          عنوان محفظة {target === "usdt" ? "TRC20" : "TON"}
        </label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={`أدخل عنوان ${target.toUpperCase()}`}
          className="w-full glass-card rounded-2xl px-4 py-4 text-sm font-mono bg-transparent outline-none focus:border-skz transition-colors border border-white/10"
          dir="ltr"
        />
      </div>

      {/* Summary */}
      {numSkz > 0 && (
        <div className="glass-card rounded-2xl p-4 space-y-2.5">
          <div className="flex justify-between text-sm">
            <span className="text-white/50">المبلغ (SKZ)</span>
            <span className="font-bold">{numSkz.toLocaleString("ar")} SKZ</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/50">يُعادل</span>
            <span className="font-bold">{realAmount.toFixed(target === "usdt" ? 2 : 3)} {target.toUpperCase()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/50">رسوم الشبكة ({feePercent * 100}%)</span>
            <span className="text-danger font-bold">-{fee.toFixed(target === "usdt" ? 2 : 3)} {target.toUpperCase()} ({feeSkz.toFixed(0)} SKZ)</span>
          </div>
          <div className="h-px bg-white/10" />
          <div className="flex justify-between text-base font-black">
            <span>صافي الاستلام</span>
            <span className="text-success">{netReal.toFixed(target === "usdt" ? 2 : 3)} {target.toUpperCase()}</span>
          </div>
        </div>
      )}

      <button
        disabled={!isValid}
        className="w-full bg-gradient-to-r from-skz to-skz-dark text-white font-bold py-4 rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed transition-transform active:scale-95 skz-glow"
      >
        تأكيد السحب
      </button>
    </div>
  );
}
