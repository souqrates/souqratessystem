import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import NotFound from "@/pages/not-found";
import { AdminLayout } from "@/components/layout";
import { AuthGuard } from "@/components/auth-guard";

// Import pages
import Dashboard from "@/pages/dashboard";
import Users from "@/pages/users";
import Wallets from "@/pages/wallets";
import Transactions from "@/pages/transactions";
import Bots from "@/pages/bots";
import Commissions from "@/pages/commissions";
import Withdrawals from "@/pages/withdrawals";
import SettingsPage from "@/pages/settings";

const queryClient = new QueryClient();

function Router() {
  return (
    <AdminLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/users" component={Users} />
        <Route path="/wallets" component={Wallets} />
        <Route path="/transactions" component={Transactions} />
        <Route path="/bots" component={Bots} />
        <Route path="/commissions" component={Commissions} />
        <Route path="/withdrawals" component={Withdrawals} />
        <Route path="/settings" component={SettingsPage} />
        <Route component={NotFound} />
      </Switch>
    </AdminLayout>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthGuard>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
          </AuthGuard>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
