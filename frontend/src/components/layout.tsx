import { ReactNode, useState, useEffect } from "react";
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
  ChevronDown,
  ChevronRight,
  Clock,
  ClipboardCheck,
  UserPlus,
  MessageSquareWarning,
  ShieldAlert,
  Paintbrush,
  IdCard,
  ArrowRightLeft,
  Award,
  Briefcase,
  Bell,
  TrendingUp,
  CalendarClock,
  Settings,
  UserCog,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { User } from "@/lib";
import { useAppSettings } from "@/hooks/use-app-settings";

interface NavItem {
  name: string;
  path: string;
  icon: any;
  roles: string[];
  customRoles?: string[];
}

interface NavGroup {
  label: string;
  icon: any;
  items: NavItem[];
}

type NavEntry = NavItem | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return "items" in entry;
}

const NAV_STRUCTURE: NavEntry[] = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard, roles: ["super_admin", "admin", "manager", "employee"] },
  {
    label: "Performance",
    icon: TrendingUp,
    items: [
      { name: "Appraisals", path: "/appraisals", icon: ClipboardList, roles: ["super_admin", "admin", "manager", "employee"] },
      { name: "Goals", path: "/goals", icon: Target, roles: ["super_admin", "admin", "manager", "employee"] },
      { name: "Cycles", path: "/cycles", icon: RefreshCcw, roles: ["super_admin", "admin", "manager"] },
      { name: "Criteria", path: "/criteria", icon: ListChecks, roles: ["super_admin", "admin"] },
    ],
  },
  {
    label: "Time & Attendance",
    icon: CalendarClock,
    items: [
      { name: "Leave", path: "/leave", icon: CalendarDays, roles: ["super_admin", "admin", "manager", "employee"] },
      { name: "Attendance", path: "/attendance", icon: Clock, roles: ["super_admin", "admin", "manager", "employee"] },
      { name: "Timesheets", path: "/timesheets", icon: ClipboardCheck, roles: ["super_admin", "admin", "manager", "employee"] },
    ],
  },
  {
    label: "People",
    icon: UserCog,
    items: [
      { name: "Staff", path: "/staff", icon: IdCard, roles: ["super_admin", "admin", "manager"], customRoles: ["hr manager"] },
      { name: "Recruitment", path: "/recruitment", icon: Briefcase, roles: ["super_admin", "admin", "manager"] },
      { name: "Onboarding", path: "/onboarding", icon: UserPlus, roles: ["super_admin", "admin"], customRoles: ["hr manager"] },
      { name: "Staff Transfer", path: "/transfers", icon: ArrowRightLeft, roles: ["super_admin", "admin", "manager"], customRoles: ["hr manager"] },
      { name: "HR Support", path: "/hr-queries", icon: MessageSquareWarning, roles: ["super_admin", "admin", "manager", "employee"], customRoles: ["hr manager"] },
      { name: "Anniversaries", path: "/anniversaries", icon: Award, roles: ["super_admin", "admin", "manager"] },
    ],
  },
  { name: "Reports", path: "/reports", icon: BarChart3, roles: ["super_admin", "admin"] },
  {
    label: "Settings",
    icon: Settings,
    items: [
      { name: "Users", path: "/users", icon: Users, roles: ["super_admin", "admin"] },
      { name: "Departments", path: "/departments", icon: Building2, roles: ["super_admin", "admin"] },
      { name: "Sites", path: "/sites", icon: MapPin, roles: ["super_admin", "admin"] },
      { name: "Roles", path: "/roles", icon: Shield, roles: ["super_admin", "admin"] },
      { name: "Security", path: "/security", icon: ShieldAlert, roles: ["super_admin", "admin"] },
      { name: "Notifications", path: "/notifications", icon: Bell, roles: ["super_admin", "admin"] },
      { name: "Appearance", path: "/appearance", icon: Paintbrush, roles: ["super_admin", "admin"] },
    ],
  },
];

interface NavLinksProps {
  user: User;
  onNavigate?: () => void;
}

function NavLinks({ user, onNavigate }: NavLinksProps) {
  const [location] = useLocation();
  const userCustomRole = (user as any).customRole ?? null;
  const userCustomRoleName = userCustomRole?.name?.toLowerCase() ?? null;
  const customMenuPerms: string[] = Array.isArray(userCustomRole?.menuPermissions) && userCustomRole.menuPermissions.length > 0
    ? userCustomRole.menuPermissions
    : [];

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      NAV_STRUCTURE.forEach((entry) => {
        if (isGroup(entry)) {
          const hasActive = entry.items.some(
            (item) => location === item.path || location.startsWith(`${item.path}/`)
          );
          if (hasActive) next[entry.label] = true;
        }
      });
      return next;
    });
  }, [location]);

  function toggleGroup(label: string) {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  function isItemVisible(item: NavItem): boolean {
    if (customMenuPerms.length > 0) {
      const menuKey = item.path.replace("/", "");
      return customMenuPerms.includes(menuKey);
    }
    if (item.roles.includes(user.role)) return true;
    if (item.customRoles && userCustomRoleName)
      return item.customRoles.some((cr) => cr.toLowerCase() === userCustomRoleName);
    return false;
  }

  return (
    <nav className="flex-1 space-y-0.5">
      {NAV_STRUCTURE.map((entry) => {
        if (isGroup(entry)) {
          const visibleItems = entry.items.filter(isItemVisible);
          if (visibleItems.length === 0) return null;

          const isOpen = openGroups[entry.label] ?? false;
          const hasActive = visibleItems.some(
            (item) => location === item.path || location.startsWith(`${item.path}/`)
          );

          return (
            <div key={entry.label} className="pt-1">
              <button
                onClick={() => toggleGroup(entry.label)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-xs font-semibold uppercase tracking-wider ${
                  hasActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <entry.icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">{entry.label}</span>
                {isOpen ? (
                  <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-60" />
                )}
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="ml-3 pl-3 border-l-2 border-border space-y-0.5 py-0.5">
                      {visibleItems.map((item) => {
                        const isActive = location === item.path || location.startsWith(`${item.path}/`);
                        return (
                          <Link
                            key={item.path}
                            href={item.path}
                            onClick={onNavigate}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 font-medium text-sm ${
                              isActive
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                          >
                            <item.icon className="w-4 h-4 shrink-0" />
                            {item.name}
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        }

        if (!isItemVisible(entry)) return null;
        const isActive = location === entry.path || location.startsWith(`${entry.path}/`);
        return (
          <Link
            key={entry.path}
            href={entry.path}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium text-sm ${
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <entry.icon className="w-5 h-5 shrink-0" />
            {entry.name}
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
  const { settings } = useAppSettings();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden sm:flex flex-col w-64 shrink-0 border-r border-border bg-card sticky top-0 h-screen">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-primary-foreground font-bold text-lg shrink-0">
            {settings.logoLetter}
          </div>
          <span className="font-bold text-xl tracking-tight">{settings.companyName}</span>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          <NavLinks user={user} />
        </div>

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

      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 sm:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="fixed top-0 left-0 h-full w-72 z-50 flex flex-col bg-card border-r border-border shadow-2xl sm:hidden"
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-primary-foreground font-bold text-lg shrink-0">
                    {settings.logoLetter}
                  </div>
                  <span className="font-bold text-xl tracking-tight">{settings.companyName}</span>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-3">
                <NavLinks user={user} onNavigate={() => setSidebarOpen(false)} />
              </div>

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

      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <header className="sm:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-card border-b border-border">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold text-sm">
              {settings.logoLetter}
            </div>
            <span className="font-bold text-base tracking-tight">{settings.companyName}</span>
          </div>
          <Link href="/profile" className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-sm border border-border">
            {userInitial(user)}
          </Link>
        </header>

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
