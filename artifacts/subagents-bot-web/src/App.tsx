import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";
import NotFound from "@/pages/not-found";

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

function App() {
  const [colorScheme, setColorScheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready?.();
      window.Telegram.WebApp.expand?.();
      
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

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <DevBanner />
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
