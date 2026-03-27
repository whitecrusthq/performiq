import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  LayoutDashboard, 
  ClipboardList, 
  Target, 
  RefreshCcw, 
  ListChecks, 
  Users, 
  Shield,
  BarChart3,
  Building2,
  MapPin,
  CalendarDays,
  LogOut,
  Menu,
  X,
  UserCircle,
  ChevronLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { User } from "@/lib";

const NAV_ITEMS = [
  { name: "Dashboard",   path: "/dashboard",   icon: LayoutDashboard, roles: ["super_admin", "admin", "manager", "employee"] },
  { name: "Appraisals",  path: "/appraisals",  icon: ClipboardList,   roles: ["super_admin", "admin", "manager", "employee"] },
  { name: "Goals",       path: "/goals",        icon: Target,          roles: ["super_admin", "admin", "manager", "employee"] },
  { name: "Leave",       path: "/leave",        icon: CalendarDays,    roles: ["super_admin", "admin", "manager", "employee"] },
  { name: "Cycles",      path: "/cycles",       icon: RefreshCcw,      roles: ["super_admin", "admin", "manager"] },
  { name: "Criteria",    path: "/criteria",     icon: ListChecks,      roles: ["super_admin", "admin"] },
  { name: "Reports",     path: "/reports",      icon: BarChart3,       roles: ["super_admin", "admin"] },
  { name: "Users",       path: "/users",        icon: Users,           roles: ["super_admin", "admin"] },
  { name: "Departments", path: "/departments",  icon: Building2,       roles: ["super_admin", "admin"] },
  { name: "Sites",       path: "/sites",        icon: MapPin,          roles: ["super_admin", "admin"] },
  { name: "Roles",       path: "/roles",        icon: Shield,          roles: ["super_admin", "admin"] },
];

interface NavLinksProps {
  user: User;
  onNavigate?: () => void;
}

function NavLinks({ user, onNavigate }: NavLinksProps) {
  const [location] = useLocation();
  const visibleItems = NAV_ITEMS.filter(item => item.roles.includes(user.role));

  return (
    <nav className="flex-1 space-y-1">
      {visibleItems.map((item) => {
        const isActive = location === item.path || location.startsWith(`${item.path}/`);
        return (
          <Link
            key={item.path}
            href={item.path}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium text-sm ${
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}

function userInitial(user: User): string {
  return (user.name ?? user.email ?? "U").charAt(0).toUpperCase();
}

function userDisplayName(user: User): string {
  return user.name ?? user.email ?? "Unknown";
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background flex">
      {/* ── Sidebar (always visible on tablet/desktop) ── */}
      <aside className="hidden sm:flex flex-col w-64 shrink-0 border-r border-border bg-card sticky top-0 h-screen">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-primary-foreground font-bold text-lg shrink-0">
            P
          </div>
          <span className="font-bold text-xl tracking-tight">PerformIQ</span>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <NavLinks user={user} />
        </div>

        {/* User Footer */}
        <div className="border-t border-border p-4 space-y-1">
          <Link
            href="/profile"
            className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-sm border border-border shrink-0">
              {userInitial(user)}
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{userDisplayName(user)}</p>
              <p className="text-xs text-muted-foreground capitalize truncate">{user.role.replace("_", " ")}</p>
            </div>
            <UserCircle className="w-4 h-4 text-muted-foreground shrink-0" />
          </Link>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors font-medium"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Mobile / Tablet Drawer ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 sm:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            {/* Drawer */}
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="fixed top-0 left-0 h-full w-72 z-50 flex flex-col bg-card border-r border-border shadow-2xl sm:hidden"
            >
              {/* Drawer Logo + Close */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-primary-foreground font-bold text-lg shrink-0">
                    P
                  </div>
                  <span className="font-bold text-xl tracking-tight">PerformIQ</span>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Nav */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <NavLinks user={user} onNavigate={() => setSidebarOpen(false)} />
              </div>

              {/* Drawer User Footer */}
              <div className="border-t border-border p-4 space-y-1">
                <Link
                  href="/profile"
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-sm border border-border shrink-0">
                    {userInitial(user)}
                  </div>
                  <div className="overflow-hidden flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{userDisplayName(user)}</p>
                    <p className="text-xs text-muted-foreground capitalize truncate">{user.role.replace("_", " ")}</p>
                  </div>
                </Link>
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors font-medium"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  Sign out
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Top bar (shown when sidebar is hidden — below sm breakpoint) */}
        <header className="sm:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-card border-b border-border">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold text-sm">
              P
            </div>
            <span className="font-bold text-base tracking-tight">PerformIQ</span>
          </div>
          <Link href="/profile" className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-sm border border-border">
            {userInitial(user)}
          </Link>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto pb-8"
          >
            {children}
          </motion.div>
        </main>

        {/* Back button bar */}
        <div className="sticky bottom-0 z-20 border-t border-border bg-card/90 backdrop-blur-sm px-4 py-2">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </button>
        </div>
      </div>
    </div>
  );
}
