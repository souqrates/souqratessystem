import { useState, useCallback } from 'react';
import { getLang, setLang, type Lang } from './lib/i18n';
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
  const [balance, setBalance] = useState(127.5);

  const toggleLang = useCallback(() => {
    const next: Lang = lang === 'ar' ? 'en' : 'ar';
    setLang(next);
    setLangState(next);
    document.documentElement.setAttribute('lang', next);
    document.documentElement.setAttribute('dir', next === 'ar' ? 'rtl' : 'ltr');
  }, [lang]);

  const deduct = useCallback((amount: number) => {
    setBalance(b => +(b - amount).toFixed(2));
  }, []);

  const credit = useCallback((amount: number) => {
    setBalance(b => +(b + amount).toFixed(2));
  }, []);

  return (
    <div className="scrch-shell" dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang}>
      <Header balance={balance} lang={lang} onToggleLang={toggleLang} onNavigate={setPage} onTopUp={() => setBalance(b => +(b + 1000).toFixed(2))} />
      <div className="scrch-scroll">
        {page === 'home'    && <Home    lang={lang} balance={balance} onNavigate={setPage} />}
        {page === 'cards'   && <Cards   lang={lang} balance={balance} onDeduct={deduct} onCredit={credit} />}
        {page === 'lotto'   && <Lotto   lang={lang} balance={balance} onDeduct={deduct} />}
        {page === 'tickets' && <Tickets lang={lang} onNavigate={setPage} />}
      </div>
      <BottomNav current={page} lang={lang} onChange={setPage} />
    </div>
  );
}
