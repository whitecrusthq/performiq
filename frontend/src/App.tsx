import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout";
import { FullPageLoader } from "@/components/shared";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Appraisals from "@/pages/appraisals";
import AppraisalDetail from "@/pages/appraisal-detail";
import Cycles from "@/pages/cycles";
import Goals from "@/pages/goals";
import Criteria from "@/pages/criteria";
import Users from "@/pages/users";
import Roles from "@/pages/roles";
import Reports from "@/pages/reports";
import Departments from "@/pages/departments";
import Sites from "@/pages/sites";
import Leave from "@/pages/leave";
import Attendance from "@/pages/attendance";
import Timesheets from "@/pages/timesheets";
import Profile from "@/pages/profile";

const queryClient = new QueryClient();

// Protected Route wrapper
function ProtectedRoute({ component: Component, ...rest }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return <FullPageLoader />;
  if (!user) return <Redirect to="/login" />;
  
  return <Component />;
}

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <FullPageLoader />;

  return (
    <Switch>
      <Route path="/">
        {user ? <Redirect to="/dashboard" /> : <Redirect to="/login" />}
      </Route>
      <Route path="/login" component={Login} />
      
      {/* Protected Routes wrapped in Layout */}
      <Route path="/dashboard">
        <AppLayout><ProtectedRoute component={Dashboard} /></AppLayout>
      </Route>
      <Route path="/appraisals">
        <AppLayout><ProtectedRoute component={Appraisals} /></AppLayout>
      </Route>
      <Route path="/appraisals/:id">
        <AppLayout><ProtectedRoute component={AppraisalDetail} /></AppLayout>
      </Route>
      <Route path="/cycles">
        <AppLayout><ProtectedRoute component={Cycles} /></AppLayout>
      </Route>
      <Route path="/goals">
        <AppLayout><ProtectedRoute component={Goals} /></AppLayout>
      </Route>
      <Route path="/criteria">
        <AppLayout><ProtectedRoute component={Criteria} /></AppLayout>
      </Route>
      <Route path="/users">
        <AppLayout><ProtectedRoute component={Users} /></AppLayout>
      </Route>
      <Route path="/roles">
        <AppLayout><ProtectedRoute component={Roles} /></AppLayout>
      </Route>
      <Route path="/reports">
        <AppLayout><ProtectedRoute component={Reports} /></AppLayout>
      </Route>
      <Route path="/departments">
        <AppLayout><ProtectedRoute component={Departments} /></AppLayout>
      </Route>
      <Route path="/sites">
        <AppLayout><ProtectedRoute component={Sites} /></AppLayout>
      </Route>
      <Route path="/leave">
        <AppLayout><ProtectedRoute component={Leave} /></AppLayout>
      </Route>
      <Route path="/attendance">
        <AppLayout><ProtectedRoute component={Attendance} /></AppLayout>
      </Route>
      <Route path="/timesheets">
        <AppLayout><ProtectedRoute component={Timesheets} /></AppLayout>
      </Route>
      <Route path="/profile">
        <AppLayout><ProtectedRoute component={Profile} /></AppLayout>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
            <Toaster />
          </AuthProvider>
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
