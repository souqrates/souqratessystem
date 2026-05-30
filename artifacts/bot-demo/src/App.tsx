import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "./components/layout";
import { Route, Switch, Router as WouterRouter } from "wouter";
import { useT } from "./lib/i18n";
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const SPLASH_KEY = "souqrates_splash_seen_v1";


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
