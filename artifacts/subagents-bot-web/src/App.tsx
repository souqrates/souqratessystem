import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import NotFound from "@/pages/not-found";
import { SplashScreen } from "@/components/SplashScreen";

import LandingRouter from "@/pages/LandingRouter";
import ApplyPage from "@/pages/Apply";
import PendingPage from "@/pages/Pending";
import RejectedPage from "@/pages/Rejected";
import SuspendedPage from "@/pages/Suspended";
import DashboardPage from "@/pages/Dashboard";
import SalesPage from "@/pages/Sales";
import SellPage from "@/pages/Sell";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingRouter} />
      <Route path="/apply" component={ApplyPage} />
      <Route path="/pending" component={PendingPage} />
      <Route path="/rejected" component={RejectedPage} />
      <Route path="/suspended" component={SuspendedPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/sales" component={SalesPage} />
      <Route path="/sell" component={SellPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function DevBanner() {
  if (typeof window !== "undefined" && window.Telegram?.WebApp?.initData) {
    return null;
  }
  return (
    <div className="bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-100 text-center py-2 text-sm font-medium sticky top-0 z-50">
      افتح التطبيق من داخل بوت تيليغرام
    </div>
  );
}

const SPLASH_KEY = "souq:splash:v1";

function App() {
  const [colorScheme, setColorScheme] = useState<"light" | "dark">("light");
  const [splashDone, setSplashDone] = useState(() => {
    try { return sessionStorage.getItem(SPLASH_KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      // ready() + expand() are called synchronously in main.tsx before React mounts
      // Only handle theme here
      const theme = window.Telegram.WebApp.colorScheme;
      if (theme) {
        setColorScheme(theme);
        if (theme === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }
    }
  }, []);

  const finishSplash = () => {
    try { sessionStorage.setItem(SPLASH_KEY, "1"); } catch {}
    setSplashDone(true);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AnimatePresence>
          {!splashDone && (
            <SplashScreen key="splash" onDone={finishSplash} />
          )}
        </AnimatePresence>
        {splashDone && (
          <>
            <DevBanner />
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
          </>
        )}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
