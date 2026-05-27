import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "./components/layout";
import { Route, Switch, Router as WouterRouter } from "wouter";
import { useLang, useT } from "./lib/i18n";
import { Home } from "./pages/home";
import { Wallet } from "./pages/wallet";
import { Deposit } from "./pages/deposit";
import { Withdraw } from "./pages/withdraw";
import { Referral } from "./pages/referral";
import { Agreement } from "./pages/agreement";
import { SubAgentsLanding } from "./pages/subagents-landing";
import { SubAgentsApply } from "./pages/subagents-apply";
import { SubAgentsPending } from "./pages/subagents-pending";
import { SubAgentsDashboard } from "./pages/subagents-dashboard";
import { SplashScreen } from "./components/splash-screen";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const SPLASH_KEY = "souqrates_splash_seen_v1";

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

function NotFoundFallback() {
  const t = useT();
  return (
    <div className="flex items-center justify-center h-full">
      <p>{t("app.notFound")}</p>
    </div>
  );
}

export default function App() {
  // Persist across iframe reloads / canvas re-mounts so the splash only ever
  // plays once per browser session. This is the #1 cause of "flicker" the
  // user perceives — the intro replaying on every navigation.
  const [splashDone, setSplashDone] = useState(() => {
    if (typeof window === "undefined") return true;
    try { return sessionStorage.getItem(SPLASH_KEY) === "1"; } catch { return false; }
  });

  const isAgreementRoute =
    typeof window !== "undefined" &&
    window.location.pathname.replace(/\/$/, "").endsWith("/agreement");

  const finishSplash = () => {
    try { sessionStorage.setItem(SPLASH_KEY, "1"); } catch {}
    setSplashDone(true);
  };

  return (
    <QueryClientProvider client={queryClient}>
      {!splashDone && !isAgreementRoute && <SplashScreen onDone={finishSplash} />}
      <FloatingLangToggle />

      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Switch>
          {/* Standalone public page — no Layout chrome (logo/footer/etc.) */}
          <Route path="/agreement" component={Agreement} />
          <Route>
            <Layout>
              <Switch>
                <Route path="/" component={Home} />
                <Route path="/wallet" component={Wallet} />
                <Route path="/deposit" component={Deposit} />
                <Route path="/withdraw" component={Withdraw} />
                <Route path="/referral" component={Referral} />
                <Route path="/subagents" component={SubAgentsLanding} />
                <Route path="/subagents/apply" component={SubAgentsApply} />
                <Route path="/subagents/pending" component={SubAgentsPending} />
                <Route path="/subagents/dashboard" component={SubAgentsDashboard} />
                <Route>
                  <NotFoundFallback />
                </Route>
              </Switch>
            </Layout>
          </Route>
        </Switch>
      </WouterRouter>
    </QueryClientProvider>
  );
}
