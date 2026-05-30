import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Login from "@/pages/Login";
import Layout from "@/pages/Layout";
import OverviewPage from "@/pages/Overview";
import BotSettingsPage from "@/pages/BotSettings";
import UsersPage from "@/pages/Users";
import UserDetailPage from "@/pages/UserDetail";
import TransactionsPage from "@/pages/Transactions";
import BroadcastPage from "@/pages/Broadcast";
import LinksPage from "@/pages/Links";
import ErrorLogsPage from "@/pages/ErrorLogs";
import WithdrawalsPage from "@/pages/Withdrawals";
import SubagentsPage from "@/pages/Subagents";
import SubagentTiersPage from "@/pages/SubagentTiers";
import AgreementsPage from "@/pages/Agreements";
import GamesPage from "@/pages/Games";
import GameDetailPage from "@/pages/GameDetail";
import BooksPage from "@/pages/Books";
import ContestsPage from "@/pages/Contests";
import ContestDetailPage from "@/pages/ContestDetail";
import VotePacksPage from "@/pages/VotePacks";
import IntegrationsPage from "@/pages/Integrations";
import AuditLogPage from "@/pages/AuditLog";
import SystemHealthPage from "@/pages/SystemHealth";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

function AuthedRoutes() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={OverviewPage} />
        <Route path="/bots/:slug" component={BotSettingsPage} />
        <Route path="/users" component={UsersPage} />
        <Route path="/users/:telegramId" component={UserDetailPage} />
        <Route path="/transactions" component={TransactionsPage} />
        <Route path="/withdrawals" component={WithdrawalsPage} />
        <Route path="/agreements" component={AgreementsPage} />
        <Route path="/games" component={GamesPage} />
        <Route path="/games/:gameId" component={GameDetailPage} />
        <Route path="/books" component={BooksPage} />
        <Route path="/contests" component={ContestsPage} />
        <Route path="/contests/:id" component={ContestDetailPage} />
        <Route path="/vote-packs" component={VotePacksPage} />
        <Route path="/broadcast" component={BroadcastPage} />
        <Route path="/links" component={LinksPage} />
        <Route path="/error-logs" component={ErrorLogsPage} />
        <Route path="/integrations" component={IntegrationsPage} />
        <Route path="/subagents" component={SubagentsPage} />
        <Route path="/subagents/tiers" component={SubagentTiersPage} />
        <Route path="/audit-log" component={AuditLogPage} />
        <Route path="/system-health" component={SystemHealthPage} />
        <Route>
          <div className="p-8" dir="rtl">الصفحة غير موجودة</div>
        </Route>
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Switch>
          <Route path="/login" component={Login} />
          <Route component={AuthedRoutes} />
        </Switch>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
