import { Layout } from "./components/layout";
import { Route, Switch, Router as WouterRouter } from "wouter";
import { Home } from "./pages/home";
import { Wallet } from "./pages/wallet";
import { Deposit } from "./pages/deposit";
import { Withdraw } from "./pages/withdraw";
import { Referral } from "./pages/referral";

export default function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
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
    </WouterRouter>
  );
}
