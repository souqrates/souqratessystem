import { Gamepad2 } from 'lucide-react';
import { isLowEnd, isMidEnd, isIOS } from '../lib/deviceProfile';
import useAppStore from '../store/appStore';

export default function Navbar() {
  const { wallet, appConfig } = useAppStore();
  const sym = appConfig?.currency_symbol || 'SKZ';
  const sc  = Number(wallet?.sc_balance) || 0;

  return (
    <header
      className="flex-shrink-0 z-40"
      style={{
        background: isIOS() ? '#04030a' : 'rgba(4,3,10,0.92)',
        ...(isLowEnd() || isIOS() ? {} : { backdropFilter: isMidEnd() ? 'blur(8px)' : 'blur(28px) saturate(180%)' }),
      }}
    >
      <div className="accent-line-top" />
      <div className="max-w-xl mx-auto flex items-center justify-between px-4 py-2.5" style={{ paddingTop: 14 }}>

        {/* Brand */}
        <div className="flex items-center gap-2">
          <Gamepad2 size={18} color="rgba(34,211,238,0.85)" strokeWidth={1.8} />
          <span className="font-orbitron text-[11px] font-black tracking-widest text-white/90">
            SOUQRATES <span style={{ color: '#22d3ee' }}>SKILLZ</span>
          </span>
        </div>

        {/* Balance pill — matches mother-bot style (white, no yellow dot) */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
          style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.18)' }}
        >
          <span className="font-orbitron text-xs font-black text-white">
            {sc.toLocaleString()}
          </span>
          <span className="font-orbitron text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(34,211,238,0.7)' }}>
            {sym}
          </span>
        </div>
      </div>
    </header>
  );
}
