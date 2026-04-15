import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AppSettingsProvider } from "@/hooks/use-app-settings";
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
import Onboarding from "@/pages/onboarding";
import Staff from "@/pages/staff";
import HrQueries from "@/pages/hr-queries";
import Profile from "@/pages/profile";
import Security from "@/pages/security";
import Appearance from "@/pages/appearance";
import Transfers from "@/pages/transfers";
import Anniversaries from "@/pages/anniversaries";

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
      <Route path="/onboarding">
        <AppLayout><ProtectedRoute component={Onboarding} /></AppLayout>
      </Route>
      <Route path="/staff">
        <AppLayout><ProtectedRoute component={Staff} /></AppLayout>
      </Route>
      <Route path="/hr-queries">
        <AppLayout><ProtectedRoute component={HrQueries} /></AppLayout>
      </Route>
      <Route path="/profile">
        <AppLayout><ProtectedRoute component={Profile} /></AppLayout>
      </Route>
      <Route path="/security">
        <AppLayout><ProtectedRoute component={Security} /></AppLayout>
      </Route>
      <Route path="/appearance">
        <AppLayout><ProtectedRoute component={Appearance} /></AppLayout>
      </Route>
      <Route path="/transfers">
        <AppLayout><ProtectedRoute component={Transfers} /></AppLayout>
      </Route>
      <Route path="/anniversaries">
        <AppLayout><ProtectedRoute component={Anniversaries} /></AppLayout>
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
          <AppSettingsProvider>
            <AuthProvider>
              <Router />
              <Toaster />
            </AuthProvider>
          </AppSettingsProvider>
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
