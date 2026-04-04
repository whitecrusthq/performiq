import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Inbox,
  Users,
  Megaphone,
  LineChart,
  Settings,
  Bell,
  LogOut,
  Bot,
  Plug,
  ShieldCheck,
  Star,
  CalendarClock,
  Brain,
  ScrollText,
  PackageSearch,
  Clock,
  ChevronDown,
  ChevronRight,
  Trophy,
  AlertCircle,
  ArrowRight,
  MessageSquare,
  Mail,
  Phone,
  Facebook,
  Instagram,
  MessageCircle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useBranding } from "@/lib/branding-context";
import { clearToken } from "@/lib/api";
import { useFollowUpNotifications, DueFollowUp } from "@/hooks/use-follow-up-notifications";
import { format, isToday, isPast } from "date-fns";

type NavItem = { name: string; href: string; icon: React.ElementType; slug: string };
type NavGroup = {
  name: string;
  icon: React.ElementType;
  slug: string;
  children: NavItem[];
};

function filterByMenus(items: NavItem[], allowedMenus: string[] | null): NavItem[] {
  if (!allowedMenus) return items;
  return items.filter((item) => allowedMenus.includes(item.slug));
}

function filterGroupByMenus(group: NavGroup, allowedMenus: string[] | null): NavGroup {
  if (!allowedMenus) return group;
  return { ...group, children: group.children.filter((c) => allowedMenus.includes(c.slug)) };
}

const FOLLOW_UP_TYPE_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  whatsapp:  { icon: MessageSquare, color: "text-green-600"  },
  sms:       { icon: MessageCircle, color: "text-blue-600"   },
  email:     { icon: Mail,          color: "text-purple-600" },
  facebook:  { icon: Facebook,      color: "text-blue-500"   },
  instagram: { icon: Instagram,     color: "text-pink-600"   },
  phone:     { icon: Phone,         color: "text-orange-600" },
};

function FollowUpNotifPanel({
  dueItems,
  overdueItems,
  todayItems,
  onClose,
  onNavigate,
}: {
  dueItems: DueFollowUp[];
  overdueItems: DueFollowUp[];
  todayItems: DueFollowUp[];
  onClose: () => void;
  onNavigate: (href: string) => void;
}) {
  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-popover border rounded-xl shadow-2xl z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Follow-up Reminders</span>
          {dueItems.length > 0 && (
            <span className="h-5 min-w-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {dueItems.length}
            </span>
          )}
        </div>
        <button
          className="text-xs text-primary hover:underline font-medium"
          onClick={() => { onNavigate("/follow-ups"); onClose(); }}
        >
          View all
        </button>
      </div>

      {/* Items */}
      <div className="max-h-80 overflow-y-auto">
        {dueItems.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <CalendarClock className="h-8 w-8 mx-auto text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No follow-ups due right now</p>
          </div>
        ) : (
          <div>
            {overdueItems.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-red-500 px-4 pt-3 pb-1.5">
                  Overdue — {overdueItems.length}
                </p>
                {overdueItems.map((fu) => <NotifItem key={fu.id} fu={fu} isOverdue onClose={onClose} onNavigate={onNavigate} />)}
              </div>
            )}
            {todayItems.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-500 px-4 pt-3 pb-1.5">
                  Due Today — {todayItems.length}
                </p>
                {todayItems.map((fu) => <NotifItem key={fu.id} fu={fu} isOverdue={false} onClose={onClose} onNavigate={onNavigate} />)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {dueItems.length > 0 && (
        <div className="px-4 py-3 border-t bg-muted/20">
          <button
            className="w-full flex items-center justify-center gap-2 text-sm text-primary font-medium hover:underline"
            onClick={() => { onNavigate("/follow-ups"); onClose(); }}
          >
            Open Follow-ups <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function NotifItem({
  fu,
  isOverdue,
  onClose,
  onNavigate,
}: {
  fu: DueFollowUp;
  isOverdue: boolean;
  onClose: () => void;
  onNavigate: (href: string) => void;
}) {
  const typeConfig = fu.followUpType ? FOLLOW_UP_TYPE_ICONS[fu.followUpType] : null;
  const TypeIcon = typeConfig?.icon;

  return (
    <button
      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-accent/60 transition-colors text-left border-b last:border-0"
      onClick={() => { onNavigate("/follow-ups"); onClose(); }}
    >
      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isOverdue ? "bg-red-100 text-red-700 dark:bg-red-900/30" : "bg-orange-100 text-orange-700 dark:bg-orange-900/30"}`}>
        {fu.customer.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium truncate">{fu.customer.name}</span>
          {TypeIcon && typeConfig && (
            <TypeIcon className={`h-3 w-3 shrink-0 ${typeConfig.color}`} />
          )}
        </div>
        {fu.followUpNote && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{fu.followUpNote}</p>
        )}
        <p className={`text-[10px] font-medium mt-0.5 ${isOverdue ? "text-red-500" : "text-orange-500"}`}>
          {isOverdue ? `Overdue · ${format(new Date(fu.followUpAt), "MMM d 'at' HH:mm")}` : `Today · ${format(new Date(fu.followUpAt), "HH:mm")}`}
        </p>
      </div>
      {isOverdue && <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />}
    </button>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { agent } = useAuth();
  const branding = useBranding();
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const { dueItems, overdueItems, todayItems, totalDue } = useFollowUpNotifications();

  const isSuperAdmin = agent?.role === "super_admin";
  const isAdmin = agent?.role === "admin" || isSuperAdmin;
  const allowedMenus = agent?.allowedMenus ?? null;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifPanel(false);
      }
    }
    if (showNotifPanel) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotifPanel]);

  const analyticsGroup: NavGroup = {
    name: "Analytics",
    icon: LineChart,
    slug: "analytics",
    children: [
      { name: "Overview",            href: "/analytics",            icon: LineChart,     slug: "analytics" },
      { name: "Intelligence",        href: "/insights",             icon: Brain,         slug: "intelligence" },
      { name: "Product Demand",      href: "/product-demand",       icon: PackageSearch, slug: "product-demand" },
      { name: "Transcripts",         href: "/transcripts",          icon: ScrollText,    slug: "transcripts" },
      { name: "Contacts Analytics",  href: "/contacts-analytics",   icon: Users,         slug: "contacts-analytics" },
    ],
  };

  const visibleAnalyticsGroup = filterGroupByMenus(analyticsGroup, allowedMenus);
  const analyticsChildPaths = analyticsGroup.children.map((c) => c.href);
  const isAnalyticsActive = analyticsChildPaths.includes(location);
  const [analyticsOpen, setAnalyticsOpen] = useState(isAnalyticsActive);

  const coreNav: NavItem[] = [
    { name: "Dashboard",   href: "/",           icon: LayoutDashboard, slug: "dashboard" },
    { name: "Inbox",       href: "/inbox",       icon: Inbox,           slug: "inbox" },
    { name: "Customers",   href: "/customers",   icon: Users,           slug: "customers" },
    { name: "Follow-ups",  href: "/follow-ups",  icon: CalendarClock,   slug: "follow-ups" },
    { name: "Feedback",    href: "/feedback",    icon: Star,            slug: "feedback" },
    { name: "Campaigns",   href: "/campaigns",   icon: Megaphone,       slug: "campaigns" },
    { name: "KPI Ranking", href: "/kpi",         icon: Trophy,          slug: "kpi" },
    { name: "Clock In",    href: "/clock-in",    icon: Clock,           slug: "clock-in" },
  ];

  const adminNav: NavItem[] = isAdmin
    ? [{ name: "User Management", href: "/admin", icon: ShieldCheck, slug: "admin" }]
    : [];

  const toolsNav: NavItem[] = [
    { name: "AI Assistant", href: "/ai-chat",   icon: Bot,      slug: "ai-chat" },
    { name: "Channels",     href: "/channels",  icon: Plug,     slug: "channels" },
    { name: "Settings",     href: "/settings",  icon: Settings, slug: "settings" },
  ];

  const visibleCore = filterByMenus(coreNav, allowedMenus);
  const visibleTools = filterByMenus(toolsNav, allowedMenus);
  const allNavFlat: NavItem[] = [
    ...visibleCore,
    ...visibleAnalyticsGroup.children,
    ...adminNav,
    ...visibleTools,
  ];

  const handleLogout = () => {
    clearToken();
    window.location.reload();
  };

  function FlatNavItem({ item }: { item: NavItem }) {
    const isActive = location === item.href;
    const isDueFollowUp = item.href === "/follow-ups" && totalDue > 0;
    return (
      <Link href={item.href}>
        <div
          className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
            isActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          }`}
          data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="text-sm flex-1">{item.name}</span>
          {isDueFollowUp && (
            <span className="h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
              {totalDue}
            </span>
          )}
        </div>
      </Link>
    );
  }

  function AnalyticsGroupNav() {
    const hasVisible = visibleAnalyticsGroup.children.length > 0;
    if (!hasVisible) return null;

    const GroupIcon = analyticsGroup.icon;
    return (
      <div>
        <button
          onClick={() => setAnalyticsOpen((o) => !o)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
            isAnalyticsActive && !analyticsOpen
              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          }`}
          data-testid="nav-analytics-group"
        >
          <GroupIcon className="h-4 w-4 shrink-0" />
          <span className="text-sm flex-1 text-left">Analytics</span>
          {analyticsOpen
            ? <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
            : <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />}
        </button>

        {analyticsOpen && (
          <div className="ml-3 mt-0.5 border-l border-sidebar-border/50 pl-2 space-y-0.5">
            {visibleAnalyticsGroup.children.map((child) => {
              const isActive = location === child.href;
              return (
                <Link key={child.href} href={child.href}>
                  <div
                    className={`flex items-center gap-2.5 px-2 py-2 rounded-md cursor-pointer transition-colors text-sm ${
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }`}
                    data-testid={`nav-${child.name.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <child.icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{child.name}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const mainBg = branding.backgroundData
    ? { backgroundImage: `url("${branding.backgroundData}")`, backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }
    : undefined;

  return (
    <div className="min-h-screen w-full flex bg-background" style={mainBg}>
      {/* Sidebar */}
      <div className="w-64 flex flex-col border-r bg-sidebar text-sidebar-foreground shrink-0">
        <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
          {branding.logoData ? (
            <img
              src={branding.logoData}
              alt={branding.appName}
              className="h-8 w-8 rounded-md object-contain bg-white/10 p-0.5"
            />
          ) : (
            <div className="h-8 w-8 bg-primary rounded-md flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
              {branding.appName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="font-bold text-lg tracking-tight truncate">{branding.appName}</span>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {visibleCore.length > 0 && (
            <>
              <p className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-3 py-2">Core</p>
              {visibleCore.map((item) => <FlatNavItem key={item.name} item={item} />)}
            </>
          )}

          {visibleAnalyticsGroup.children.length > 0 && (
            <div className="mt-3">
              <AnalyticsGroupNav />
            </div>
          )}

          {adminNav.length > 0 && (
            <>
              <p className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-3 py-2 mt-3">Admin</p>
              {adminNav.map((item) => <FlatNavItem key={item.name} item={item} />)}
            </>
          )}

          {visibleTools.length > 0 && (
            <>
              <p className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-3 py-2 mt-3">Tools</p>
              {visibleTools.map((item) => <FlatNavItem key={item.name} item={item} />)}
            </>
          )}
        </nav>

        <div className="p-3 border-t border-sidebar-border flex items-center gap-3">
          <Avatar className="h-8 w-8 border border-sidebar-border shrink-0">
            <AvatarImage src={`https://i.pravatar.cc/150?u=${agent?.email}`} />
            <AvatarFallback className="text-xs">{agent?.name?.charAt(0) ?? "A"}</AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate">{agent?.name ?? "Agent"}</p>
            <p className="text-xs text-sidebar-foreground/60 truncate capitalize">{agent?.role ?? "agent"}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={handleLogout}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {/* Header */}
        <header className="h-14 border-b bg-card/90 backdrop-blur-sm flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="text-foreground font-medium">
                {allNavFlat.find((n) => n.href === location)?.name ?? branding.appName}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Online
            </div>

            {/* Notification bell */}
            <div className="relative" ref={notifRef}>
              <Button
                variant="ghost"
                size="icon"
                className={`relative h-8 w-8 ${totalDue > 0 ? "text-destructive" : "text-muted-foreground"}`}
                onClick={() => setShowNotifPanel((p) => !p)}
                title="Follow-up reminders"
              >
                <Bell className="h-4 w-4" />
                {totalDue > 0 ? (
                  <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-0.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                    {totalDue > 9 ? "9+" : totalDue}
                  </span>
                ) : (
                  <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 bg-muted-foreground/30 rounded-full" />
                )}
              </Button>

              {showNotifPanel && (
                <FollowUpNotifPanel
                  dueItems={dueItems}
                  overdueItems={overdueItems}
                  todayItems={todayItems}
                  onClose={() => setShowNotifPanel(false)}
                  onNavigate={(href) => setLocation(href)}
                />
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
