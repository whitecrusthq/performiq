import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Layout from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Inbox from "@/pages/inbox";
import Customers from "@/pages/customers";
import Campaigns from "@/pages/campaigns";
import Analytics from "@/pages/analytics";
import Settings from "@/pages/settings";
import Channels from "@/pages/channels";
import AiChat from "@/pages/ai-chat";
import Admin from "@/pages/admin";
import Feedback from "@/pages/feedback";
import FollowUps from "@/pages/follow-ups";
import Insights from "@/pages/insights";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  },
});

function PrivateRoute({ component: Component }: { component: React.ComponentType }) {
  const { agent, isLoading } = useAuth();
  if (isLoading) return null;
  if (!agent) return <Redirect to="/login" />;
  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { agent, isLoading } = useAuth();
  if (isLoading) return null;
  if (!agent) return <Redirect to="/login" />;
  if (agent.role !== "admin") return <Redirect to="/" />;
  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <PrivateRoute component={Dashboard} />} />
      <Route path="/inbox" component={() => <PrivateRoute component={Inbox} />} />
      <Route path="/customers" component={() => <PrivateRoute component={Customers} />} />
      <Route path="/campaigns" component={() => <PrivateRoute component={Campaigns} />} />
      <Route path="/analytics" component={() => <PrivateRoute component={Analytics} />} />
      <Route path="/settings" component={() => <PrivateRoute component={Settings} />} />
      <Route path="/channels" component={() => <PrivateRoute component={Channels} />} />
      <Route path="/ai-chat" component={() => <PrivateRoute component={AiChat} />} />
      <Route path="/admin" component={() => <AdminRoute component={Admin} />} />
      <Route path="/feedback" component={() => <PrivateRoute component={Feedback} />} />
      <Route path="/follow-ups" component={() => <PrivateRoute component={FollowUps} />} />
      <Route path="/insights" component={() => <PrivateRoute component={Insights} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
