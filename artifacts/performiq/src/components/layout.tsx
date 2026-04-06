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
  Clock,
  ClipboardCheck,
  UserPlus,
  MessageSquareWarning,
  ShieldAlert,
  Paintbrush,
  IdCard,
  TrendingUp,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { User } from "@/lib";
import { useAppSettings } from "@/hooks/use-app-settings";

// ── Nav data ──────────────────────────────────────────────────────────────────

type NavItem = {
  name: string;
  path: string;
  icon: any;
  roles: string[];
  customRoles?: string[];
};

type NavGroup = {
  name: string;
  icon: any;
  roles: string[];
  customRoles?: string[];
  children: NavItem[];
};

type NavEntry = NavItem | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return "children" in entry;
}

const NAV_ENTRIES: NavEntry[] = [
  { name: "Dashboard",   path: "/dashboard",   icon: LayoutDashboard, roles: ["super_admin", "admin", "manager", "employee"] },
  {
    name: "KPI",
    icon: TrendingUp,
    roles: ["super_admin", "admin", "manager", "employee"],
    children: [
      { name: "Appraisals", path: "/appraisals", icon: ClipboardList, roles: ["super_admin", "admin", "manager", "employee"] },
      { name: "Goals",      path: "/goals",      icon: Target,        roles: ["super_admin", "admin", "manager", "employee"] },
      { name: "Criteria",   path: "/criteria",   icon: ListChecks,    roles: ["super_admin", "admin"] },
      { name: "Cycles",     path: "/cycles",     icon: RefreshCcw,    roles: ["super_admin", "admin", "manager"] },
    ],
  },
  {
    name: "Workforce",
    icon: Clock,
    roles: ["super_admin", "admin", "manager", "employee"],
    children: [
      { name: "Leave",      path: "/leave",      icon: CalendarDays,   roles: ["super_admin", "admin", "manager", "employee"] },
      { name: "Attendance", path: "/attendance", icon: Clock,          roles: ["super_admin", "admin", "manager", "employee"] },
      { name: "Timesheets", path: "/timesheets", icon: ClipboardCheck, roles: ["super_admin", "admin", "manager", "employee"] },
    ],
  },
  {
    name: "People",
    icon: Users,
    roles: ["super_admin", "admin", "manager", "employee"],
    children: [
      { name: "Onboarding", path: "/onboarding", icon: UserPlus,             roles: ["super_admin", "admin"], customRoles: ["hr manager"] },
      { name: "Staff",      path: "/staff",      icon: IdCard,               roles: ["super_admin", "admin", "manager"], customRoles: ["hr manager"] },
      { name: "HR Queries", path: "/hr-queries", icon: MessageSquareWarning, roles: ["super_admin", "admin", "manager", "employee"], customRoles: ["hr manager"] },
    ],
  },
  { name: "Reports", path: "/reports", icon: BarChart3, roles: ["super_admin", "admin"] },
  {
    name: "Administration",
    icon: Building2,
    roles: ["super_admin", "admin"],
    children: [
      { name: "Users",       path: "/users",       icon: Users,    roles: ["super_admin", "admin"] },
      { name: "Departments", path: "/departments", icon: Building2, roles: ["super_admin", "admin"] },
      { name: "Sites",       path: "/sites",       icon: MapPin,   roles: ["super_admin", "admin"] },
      { name: "Roles",       path: "/roles",       icon: Shield,   roles: ["super_admin", "admin"] },
    ],
  },
  {
    name: "Settings",
    icon: Paintbrush,
    roles: ["super_admin", "admin"],
    children: [
      { name: "Security",   path: "/security",   icon: ShieldAlert, roles: ["super_admin", "admin"] },
      { name: "Appearance", path: "/appearance", icon: Paintbrush,  roles: ["super_admin", "admin"] },
    ],
  },
];

// ── NavLinks component ────────────────────────────────────────────────────────

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

  // Check if user can see a flat item
  const canSeeItem = (item: NavItem) => {
    if (customMenuPerms.length > 0) {
      return customMenuPerms.includes(item.path.replace("/", ""));
    }
    if (item.roles.includes(user.role)) return true;
    if (item.customRoles && userCustomRoleName)
      return item.customRoles.some(cr => cr.toLowerCase() === userCustomRoleName);
    return false;
  };

  // Check if user can see a group (if any child is visible)
  const canSeeGroup = (group: NavGroup) => {
    if (customMenuPerms.length > 0) {
      return group.children.some(c => customMenuPerms.includes(c.path.replace("/", "")));
    }
    if (!group.roles.includes(user.role)) {
      if (!group.customRoles || !userCustomRoleName) return false;
      if (!group.customRoles.some(cr => cr.toLowerCase() === userCustomRoleName)) return false;
    }
    return group.children.some(c => canSeeItem(c));
  };

  // Figure out if any KPI child is currently active (for auto-expand)
  const kpiPaths        = ["/appraisals", "/goals", "/criteria", "/cycles"];
  const workforcePaths  = ["/leave", "/attendance", "/timesheets"];
  const peoplePaths     = ["/onboarding", "/staff", "/hr-queries"];
  const adminPaths      = ["/users", "/departments", "/sites", "/roles"];
  const settingsPaths   = ["/security", "/appearance"];

  const inside = (paths: string[]) => paths.some(p => location === p || location.startsWith(`${p}/`));

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => ({
    KPI:            inside(kpiPaths),
    Workforce:      inside(workforcePaths),
    People:         inside(peoplePaths),
    Administration: inside(adminPaths),
    Settings:       inside(settingsPaths),
  }));

  const toggleGroup = (name: string) =>
    setOpenGroups(prev => ({ ...prev, [name]: !prev[name] }));

  const linkClass = (active: boolean) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm ${
      active
        ? "bg-primary text-primary-foreground shadow-sm"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`;

  return (
    <nav className="flex-1 space-y-0.5">
      {NAV_ENTRIES.map(entry => {
        if (isGroup(entry)) {
          if (!canSeeGroup(entry)) return null;

          const visibleChildren = entry.children.filter(canSeeItem);
          const isGroupActive = visibleChildren.some(
            c => location === c.path || location.startsWith(`${c.path}/`)
          );
          const isOpen = openGroups[entry.name] ?? isGroupActive;

          return (
            <div key={entry.name}>
              {/* Group header button */}
              <button
                onClick={() => toggleGroup(entry.name)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm ${
                  isGroupActive && !isOpen
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <entry.icon className="w-5 h-5 shrink-0" />
                <span className="flex-1 text-left">{entry.name}</span>
                <ChevronDown
                  className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                />
              </button>

              {/* Children */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key="children"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="ml-4 mt-0.5 mb-0.5 pl-3 border-l-2 border-border space-y-0.5">
                      {visibleChildren.map(child => {
                        const isActive = location === child.path || location.startsWith(`${child.path}/`);
                        return (
                          <Link
                            key={child.path}
                            href={child.path}
                            onClick={onNavigate}
                            className={linkClass(isActive)}
                          >
                            <child.icon className="w-4 h-4 shrink-0" />
                            {child.name}
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

        // Flat item
        if (!canSeeItem(entry)) return null;
        const isActive = location === entry.path || location.startsWith(`${entry.path}/`);
        return (
          <Link
            key={entry.path}
            href={entry.path}
            onClick={onNavigate}
            className={linkClass(isActive)}
          >
            <entry.icon className="w-5 h-5 shrink-0" />
            {entry.name}
          </Link>
        );
      })}
    </nav>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function userInitial(user: User): string {
  return (user.name ?? user.email ?? "U").charAt(0).toUpperCase();
}

function userDisplayName(user: User): string {
  return user.name ?? user.email ?? "Unknown";
}

// ── AppLayout ─────────────────────────────────────────────────────────────────

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { settings } = useAppSettings();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) return <>{children}</>;

  const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {/* Nav */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <NavLinks user={user} onNavigate={onNavigate} />
      </div>

      {/* User Footer */}
      <div className="border-t border-border p-4 space-y-1">
        <Link
          href="/profile"
          onClick={onNavigate}
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
    </>
  );

  const LogoBlock = () => (
    <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
      <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-primary-foreground font-bold text-lg shrink-0">
        {settings.logoLetter}
      </div>
      <span className="font-bold text-xl tracking-tight">{settings.companyName}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden sm:flex flex-col w-64 shrink-0 border-r border-border bg-card sticky top-0 h-screen">
        <LogoBlock />
        <SidebarContent />
      </aside>

      {/* ── Mobile Drawer ── */}
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
              <SidebarContent onNavigate={() => setSidebarOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Mobile top bar */}
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

        {/* Back button */}
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
