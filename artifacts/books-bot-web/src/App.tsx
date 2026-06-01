import "./index.css";
import { useEffect, useState } from "react";
import { Router, Route, Switch, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useLang, useT } from "@/lib/i18n";
import { Splash } from "@/components/Splash";
import { Page } from "@/components/Layout";
import Home from "@/pages/Home";
import Library from "@/pages/Library";
import Category from "@/pages/Category";
import BookPage from "@/pages/Book";
import Publish from "@/pages/Publish";
import DigitalServices from "@/pages/DigitalServices";
import MyLibrary from "@/pages/MyLibrary";
import NotFound from "@/pages/not-found";

const SPLASH_STORAGE_KEY = "souq:splashSeen";

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [location]);
  return null;
}

function FloatingLangToggle() {
  const [lang, setLang] = useLang();
  const t = useT();
  const next = lang === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      className="fixed top-14 left-3 z-50 text-xs font-black px-2.5 py-1.5 rounded-lg transition-all hover:scale-105"
      style={{
        background: 'rgba(34,211,238,0.1)',
        color: '#22d3ee',
        border: '1px solid rgba(34,211,238,0.25)',
        backdropFilter: 'blur(8px)',
      }}
      aria-label={t("langToggle.aria")}
      title={t("langToggle.title")}
    >
      {lang === "ar" ? "EN" : "ع"}
    </button>
  );
}

const PAGE_VARIANTS = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' as const } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.15, ease: 'easeIn' as const } },
};

function AnimatedRoutes() {
  const [location] = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={location} variants={PAGE_VARIANTS} initial="initial" animate="animate" exit="exit">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/library" component={Library} />
          <Route path="/category/:slug" component={Category} />
          <Route path="/book/:id" component={BookPage} />
          <Route path="/publish" component={Publish} />
          <Route path="/digital" component={DigitalServices} />
          <Route path="/my-library" component={MyLibrary} />
          <Route component={NotFound} />
        </Switch>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  const [splashDone, setSplashDone] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try { return window.sessionStorage.getItem(SPLASH_STORAGE_KEY) === "1"; }
    catch { return false; }
  });

  const finishSplash = () => {
    try { window.sessionStorage.setItem(SPLASH_STORAGE_KEY, "1"); } catch {}
    setSplashDone(true);
  };

  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

  return (
    <>
      {!splashDone && <Splash onDone={finishSplash} />}
      <FloatingLangToggle />
      <Router base={base}>
        <ScrollToTop />
        <Page>
          <AnimatedRoutes />
        </Page>
      </Router>
    </>
  );
}
