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
import { Toaster } from "sonner";
import { Globe } from "lucide-react";

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
      aria-label={t("langToggle.aria")}
      title={t("langToggle.title")}
      style={{
        position: "fixed",
        bottom: "calc(60px + env(safe-area-inset-bottom, 0px) + 14px)",
        right: 14,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px 6px 8px",
        borderRadius: 999,
        background: "rgba(12, 18, 32, 0.88)",
        border: "1px solid rgba(168,85,247,0.35)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(168,85,247,0.15)",
        cursor: "pointer",
        transition: "all 0.18s ease",
      }}
    >
      <Globe size={14} color="#c084fc" />
      <span style={{ fontSize: 11, fontWeight: 800, color: "#c084fc", letterSpacing: "0.06em" }}>
        {lang === "ar" ? "EN" : "ع"}
      </span>
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
  const [splashDone, setSplashDone] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      if (new URL(window.location.href).searchParams.has("nosplash")) return true;
      return sessionStorage.getItem(SPLASH_KEY) === "1";
    } catch { return false; }
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
      <Toaster
        position="top-center"
        theme="dark"
        richColors
        toastOptions={{
          style: {
            background: "rgba(12,18,32,0.95)",
            border: "1px solid rgba(168,85,247,0.3)",
            color: "#fff",
            fontFamily: "Inter Variable, Inter, sans-serif",
            fontWeight: 600,
            fontSize: 13,
            backdropFilter: "blur(20px)",
          },
        }}
      />
      {!splashDone && !isAgreementRoute && <SplashScreen onDone={finishSplash} />}
      <FloatingLangToggle />

      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Switch>
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
