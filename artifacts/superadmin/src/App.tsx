import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Login from "@/pages/Login";
import Layout from "@/pages/Layout";
import OverviewPage from "@/pages/Overview";
import BotSettingsPage from "@/pages/BotSettings";
import UsersPage from "@/pages/Users";
import UserDetailPage from "@/pages/UserDetail";
import TransactionsPage from "@/pages/Transactions";

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
