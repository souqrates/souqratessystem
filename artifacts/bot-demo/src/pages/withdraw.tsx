import { useState } from "react";
import { MOCK_BALANCES } from "../lib/mock-data";
import { CircleDollarSign, Star, Gem } from "lucide-react";

type Method = "usdt" | "ton";

export function Withdraw() {
  const [method, setMethod] = useState<Method>("usdt");
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");

  const maxAmount = method === "usdt" ? MOCK_BALANCES.usdt : MOCK_BALANCES.ton;
  const numAmount = parseFloat(amount || "0");
  const isOverMax = numAmount > maxAmount;
  const fee = method === "usdt" ? 1 : 0.05;
  const net = Math.max(0, numAmount - fee);
  
  const isValid = numAmount > fee && !isOverMax && address.length > 10;

  return (
    <div className="p-4 space-y-6 pb-20">
      <h1 className="text-2xl font-bold mt-2">سحب الأرباح</h1>
      
      {/* Balances */}
      <div className="flex gap-2">
        <button 
          onClick={() => setMethod("usdt")}
          className={`flex-1 p-3 rounded-2xl border transition-all flex flex-col items-center gap-1 ${method === 'usdt' ? 'border-usdt bg-usdt/10' : 'border-white/5 glass-card'}`}
        >
          <CircleDollarSign size={20} className={method === 'usdt' ? 'text-usdt' : 'text-white/40'} />
          <span className="font-bold text-sm">{MOCK_BALANCES.usdt.toFixed(2)}</span>
        </button>
        <button 
          onClick={() => setMethod("ton")}
          className={`flex-1 p-3 rounded-2xl border transition-all flex flex-col items-center gap-1 ${method === 'ton' ? 'border-ton bg-ton/10' : 'border-white/5 glass-card'}`}
        >
          <Gem size={20} className={method === 'ton' ? 'text-ton' : 'text-white/40'} />
          <span className="font-bold text-sm">{MOCK_BALANCES.ton.toFixed(3)}</span>
        </button>
      </div>

      <div className="space-y-4 pt-4 border-t border-white/10">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-bold text-white/80">المبلغ</label>
            <span className="text-xs text-white/50">المتاح: {maxAmount.toFixed(method === 'usdt' ? 2 : 3)}</span>
          </div>
          <div className="relative">
            <input 
              type="number" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full glass-card border-white/10 rounded-2xl px-4 py-4 text-xl font-bold bg-transparent outline-none focus:border-accent transition-colors"
              dir="ltr"
              style={{ textAlign: 'right' }}
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button 
                onClick={() => setAmount(maxAmount.toString())}
                className="text-[10px] font-bold bg-white/10 px-2 py-1 rounded-md text-white/80 hover:bg-white/20"
              >
                الكل
              </button>
              <span className="font-bold text-white/40">{method.toUpperCase()}</span>
            </div>
          </div>
          {isOverMax && <p className="text-xs text-danger">المبلغ يتجاوز الرصيد المتاح</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-white/80">عنوان المحفظة ({method === 'usdt' ? 'TRC20' : 'TON'})</label>
          <input 
            type="text" 
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={`أدخل عنوان ${method.toUpperCase()} الخاص بك`}
            className="w-full glass-card border-white/10 rounded-2xl px-4 py-4 text-sm font-mono bg-transparent outline-none focus:border-accent transition-colors"
            dir="ltr"
          />
        </div>

        <div className="glass-card rounded-2xl p-4 space-y-2 mt-6">
          <div className="flex justify-between text-sm">
            <span className="text-white/60">المبلغ المدخل</span>
            <span className="font-medium">{numAmount || 0} {method.toUpperCase()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/60">رسوم الشبكة</span>
            <span className="font-medium text-danger">-{fee} {method.toUpperCase()}</span>
          </div>
          <div className="h-px w-full bg-white/10 my-1"></div>
          <div className="flex justify-between text-base font-bold">
            <span className="text-white">صافي الاستلام</span>
            <span className="text-success">{net.toFixed(method === 'usdt' ? 2 : 3)} {method.toUpperCase()}</span>
          </div>
        </div>

        <button 
          disabled={!isValid}
          className="w-full bg-accent text-base font-bold py-4 rounded-2xl mt-4 disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-95"
        >
          تأكيد السحب
        </button>
      </div>
    </div>
  );
}
