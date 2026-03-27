import { ReactNode } from "react";
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
  LogOut,
  Menu,
  UserCircle,
  ChevronLeft,
  ChevronRight,
  Home
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!user) return <>{children}</>;

  const isAdmin = user.role === "admin" || user.role === "super_admin";

  const navItems = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard, roles: ["super_admin", "admin", "manager", "employee"] },
    { name: "Appraisals", path: "/appraisals", icon: ClipboardList, roles: ["super_admin", "admin", "manager", "employee"] },
    { name: "Goals", path: "/goals", icon: Target, roles: ["super_admin", "admin", "manager", "employee"] },
    { name: "Cycles", path: "/cycles", icon: RefreshCcw, roles: ["super_admin", "admin", "manager"] },
    { name: "Criteria", path: "/criteria", icon: ListChecks, roles: ["super_admin", "admin"] },
    { name: "Reports", path: "/reports", icon: BarChart3, roles: ["super_admin", "admin"] },
    { name: "Users", path: "/users", icon: Users, roles: ["super_admin", "admin"] },
    { name: "Departments", path: "/departments", icon: Building2, roles: ["super_admin", "admin"] },
    { name: "Roles", path: "/roles", icon: Shield, roles: ["super_admin", "admin"] },
  ];

  const visibleNavItems = navItems.filter(item => item.roles.includes(user.role));

  const NavLinks = () => (
    <>
      {visibleNavItems.map((item) => {
        const isActive = location === item.path || location.startsWith(`${item.path}/`);
        return (
          <Link key={item.path} href={item.path} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${isActive ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`} onClick={() => setIsMobileMenuOpen(false)}>
            <item.icon className={`w-5 h-5 ${isActive ? 'opacity-100' : 'opacity-70'}`} />
            {item.name}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-card border-b border-border sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold font-display">P</div>
          <span className="font-display font-bold text-lg">PerformIQ</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-foreground">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <motion.div 
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-3/4 max-w-sm h-full bg-card p-6 shadow-2xl flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-8 px-2">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-primary-foreground font-bold text-xl font-display shadow-sm">P</div>
                <span className="font-display font-bold text-2xl tracking-tight text-foreground">PerformIQ</span>
              </div>
              <nav className="flex-1 space-y-1">
                <NavLinks />
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 lg:w-72 border-r border-border bg-card/50 backdrop-blur-xl sticky top-0 h-screen p-6">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center text-primary-foreground font-bold text-xl font-display shadow-lg shadow-primary/20">
            <span className="drop-shadow-sm">P</span>
          </div>
          <span className="font-display font-bold text-2xl tracking-tight text-foreground">PerformIQ</span>
        </div>
        
        <nav className="flex-1 space-y-1.5">
          <NavLinks />
        </nav>

        <div className="pt-6 border-t border-border mt-auto">
          <Link href="/profile" className="flex items-center gap-3 px-3 py-2 mb-2 rounded-xl hover:bg-muted transition-colors cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-bold border border-border shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground capitalize truncate">
                {user.role === "super_admin" ? (
                  <span className="inline-flex items-center gap-1 text-violet-600 font-semibold">⭐ Super Admin</span>
                ) : user.role}
              </p>
            </div>
            <UserCircle className="w-4 h-4 text-muted-foreground shrink-0" />
          </Link>
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors duration-200 font-medium"
          >
            <LogOut className="w-5 h-5 opacity-70" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen max-h-screen overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 relative">
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
            className="max-w-6xl mx-auto pb-24"
          >
            {children}
          </motion.div>
        </div>

        {/* Sticky footer navigation */}
        <div className="sticky bottom-0 z-20 border-t border-border bg-card/80 backdrop-blur-md px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.history.back()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow transition-all duration-200 active:scale-95"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={() => window.history.forward()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow transition-all duration-200 active:scale-95"
              >
                Forward <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <Link href="/dashboard">
              <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow transition-all duration-200 active:scale-95">
                <Home className="w-4 h-4" /> Home
              </button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
