import { useState } from "react";
import { Star, CircleDollarSign, Gem, Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Method = "stars" | "usdt" | "ton";

export function Deposit() {
  const [method, setMethod] = useState<Method>("usdt");
  const [amount, setAmount] = useState("");
  const [copied, setCopied] = useState(false);

  const address = "TRX9xKmN4pQ8vLs2wYjF7bDcAeR6hZmU1";

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    
    // Fallback toast if telegram API exists
    if (window.Telegram?.WebApp?.showPopup) {
      window.Telegram.WebApp.showPopup({ message: "تم نسخ العنوان" });
    }
  };

  return (
    <div className="p-4 space-y-6 pb-20">
      <h1 className="text-2xl font-bold mt-2">إيداع</h1>
      
      <div className="space-y-3">
        <p className="text-sm text-white/60 mb-2">اختر طريقة الإيداع</p>
        
        <div 
          onClick={() => setMethod("usdt")}
          className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${method === 'usdt' ? 'border-usdt bg-usdt/10' : 'border-white/5 glass-card'}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-usdt/20 flex items-center justify-center text-usdt">
              <CircleDollarSign size={20} />
            </div>
            <div>
              <p className="font-bold text-sm">USDT</p>
              <p className="text-xs text-white/50">عبر شبكة TRC20</p>
            </div>
          </div>
        </div>

        <div 
          onClick={() => setMethod("stars")}
          className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${method === 'stars' ? 'border-stars bg-stars/10' : 'border-white/5 glass-card'}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-stars/20 flex items-center justify-center text-stars">
              <Star size={20} className="fill-stars" />
            </div>
            <div>
              <p className="font-bold text-sm">Telegram Stars</p>
              <p className="text-xs text-white/50">ادفع مباشرة من رصيد تيليغرام</p>
            </div>
          </div>
        </div>

        <div 
          onClick={() => setMethod("ton")}
          className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${method === 'ton' ? 'border-ton bg-ton/10' : 'border-white/5 glass-card'}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-ton/20 flex items-center justify-center text-ton">
              <Gem size={20} className="fill-ton" />
            </div>
            <div>
              <p className="font-bold text-sm">TON</p>
              <p className="text-xs text-white/50">إيداع مباشر بلوك تشين</p>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {method === "stars" && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            key="stars-form"
            className="space-y-4 pt-4 border-t border-white/10"
          >
            <p className="text-sm font-bold">حدد المبلغ:</p>
            <div className="grid grid-cols-3 gap-2">
              {[50, 100, 250, 500, 1000].map((val) => (
                <button 
                  key={val}
                  onClick={() => setAmount(val.toString())}
                  className={`py-3 rounded-xl font-bold text-sm transition-colors ${amount === val.toString() ? 'bg-stars text-base' : 'glass-card text-white hover:bg-white/10'}`}
                >
                  {val} ⭐
                </button>
              ))}
            </div>
            
            <button 
              disabled={!amount}
              className="w-full bg-accent text-base font-bold py-4 rounded-2xl mt-4 disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-95"
            >
              ادفع الآن {amount ? `(${amount} Stars)` : ''}
            </button>
          </motion.div>
        )}

        {(method === "usdt" || method === "ton") && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            key="crypto-form"
            className="space-y-4 pt-4 border-t border-white/10"
          >
            <div className="bg-white p-4 rounded-3xl w-48 h-48 mx-auto flex items-center justify-center mb-6">
              {/* QR Code Placeholder */}
              <div className="w-full h-full border-4 border-dashed border-base rounded-xl flex items-center justify-center relative">
                <div className="absolute inset-4 border-2 border-base"></div>
                <div className="absolute inset-8 border-4 border-base rounded-sm bg-base"></div>
                <div className="absolute top-0 left-0 w-8 h-8 bg-base"></div>
                <div className="absolute top-0 right-0 w-8 h-8 bg-base"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 bg-base"></div>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-4 relative">
              <p className="text-xs text-white/50 mb-1">عنوان الإيداع ({method === 'usdt' ? 'TRC20' : 'TON'})</p>
              <p className="font-mono text-sm break-all pr-10 leading-relaxed text-white/90">{address}</p>
              
              <button 
                onClick={handleCopy}
                className="absolute top-1/2 -translate-y-1/2 left-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
              </button>
            </div>
            
            <div className="glass-card p-4 rounded-2xl text-xs text-white/60 space-y-1">
              <p className="text-danger font-medium">• أرسل فقط {method.toUpperCase()} إلى هذا العنوان.</p>
              <p>• الحد الأدنى للإيداع: {method === 'usdt' ? '5 USDT' : '0.5 TON'}.</p>
              <p>• سيظهر الرصيد تلقائياً بعد تأكيد الشبكة.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
