import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "./components/layout";
import { Route, Switch, Router as WouterRouter } from "wouter";
import { Home } from "./pages/home";
import { Wallet } from "./pages/wallet";
import { Deposit } from "./pages/deposit";
import { Withdraw } from "./pages/withdraw";
import { Referral } from "./pages/referral";
import { Agreement } from "./pages/agreement";
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
                <Route>
                  <div className="flex items-center justify-center h-full">
                    <p>الصفحة غير موجودة</p>
                  </div>
                </Route>
              </Switch>
            </Layout>
          </Route>
        </Switch>
      </WouterRouter>
    </QueryClientProvider>
  );
}
