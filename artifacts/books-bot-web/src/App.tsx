import "./index.css";
import { useEffect, useState } from "react";
import { Router, Route, Switch, useLocation } from "wouter";
import { useLang, useT } from "@/lib/i18n";
import { Splash } from "@/components/Splash";
import { Page } from "@/components/Layout";
import Home from "@/pages/Home";
import Library from "@/pages/Library";
import Category from "@/pages/Category";
import BookPage from "@/pages/Book";
import Publish from "@/pages/Publish";
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
      className="fixed top-3 left-3 z-50 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-black/70 text-white border border-white/20 backdrop-blur hover:bg-black/85 transition shadow-lg"
      aria-label={t("langToggle.aria")}
      title={t("langToggle.title")}
    >
      {lang === "ar" ? "EN" : "ع"}
    </button>
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
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/library" component={Library} />
            <Route path="/category/:slug" component={Category} />
            <Route path="/book/:id" component={BookPage} />
            <Route path="/publish" component={Publish} />
            <Route component={NotFound} />
          </Switch>
        </Page>
      </Router>
    </>
  );
}
