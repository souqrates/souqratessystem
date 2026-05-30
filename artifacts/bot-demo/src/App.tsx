import { useState, useCallback, useEffect } from 'react';
import { getLang, setLang, type Lang } from './lib/i18n';
import { useBalance } from './lib/useBalance';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import Cards from './pages/Cards';
import Lotto from './pages/Lotto';
import Tickets from './pages/Tickets';

export type Page = 'home' | 'cards' | 'lotto' | 'tickets';

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [lang, setLangState] = useState<Lang>(getLang());
  const [jackpot, setJackpot] = useState(5000);
  const [lottoTrigger, setLottoTrigger] = useState(0);
  const [participants, setParticipants] = useState(1247);

  const { skz: balance, loading: balanceLoading, refresh: refreshBalance, applyDeduct, applyCredit } = useBalance();

  // Initialise Telegram WebApp
  useEffect(() => {
    try {
      window.Telegram?.WebApp?.ready?.();
    } catch {
      // not in Telegram — dev mode
    }
  }, []);

  const toggleLang = useCallback(() => {
    const next: Lang = lang === 'ar' ? 'en' : 'ar';
    setLang(next);
    setLangState(next);
    document.documentElement.setAttribute('lang', next);
    document.documentElement.setAttribute('dir', next === 'ar' ? 'rtl' : 'ltr');
  }, [lang]);

  const deduct = useCallback((amount: number) => {
    applyDeduct(amount);
  }, [applyDeduct]);

  const credit = useCallback((amount: number) => {
    applyCredit(amount);
  }, [applyCredit]);

  const buyLottoTicket = useCallback((ticketPrice: number) => {
    applyDeduct(ticketPrice);
    setJackpot(j => j + ticketPrice * 3);
    setParticipants(p => p + 1);
    setLottoTrigger(t => t + 1);
  }, [applyDeduct]);

  // Refresh balance when user navigates back to home
  const handleNavigate = useCallback((p: Page) => {
    setPage(p);
    if (p === 'home') refreshBalance();
  }, [refreshBalance]);

  return (
    <div className="scrch-shell" dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang}>
      <Header
        balance={balance}
        balanceLoading={balanceLoading}
        lang={lang}
        onToggleLang={toggleLang}
        onNavigate={setPage}
        onTopUp={refreshBalance}
      />
      <div className="scrch-scroll">
        {page === 'home' && (
          <Home
            lang={lang}
            balance={balance}
            jackpot={jackpot}
            lottoTrigger={lottoTrigger}
            participants={participants}
            onNavigate={handleNavigate}
          />
        )}
        {page === 'cards'   && <Cards   lang={lang} balance={balance} onDeduct={deduct} onCredit={credit} />}
        {page === 'lotto'   && <Lotto   lang={lang} balance={balance} onBuyTicket={buyLottoTicket} />}
        {page === 'tickets' && <Tickets lang={lang} onNavigate={handleNavigate} />}
      </div>
      <BottomNav current={page} lang={lang} onChange={handleNavigate} />
    </div>
  );
}
