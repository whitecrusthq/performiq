import React from "react";
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
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { clearToken } from "@/lib/api";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { agent } = useAuth();

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard, group: "core" },
    { name: "Inbox", href: "/inbox", icon: Inbox, group: "core" },
    { name: "Customers", href: "/customers", icon: Users, group: "core" },
    { name: "Campaigns", href: "/campaigns", icon: Megaphone, group: "core" },
    { name: "Analytics", href: "/analytics", icon: LineChart, group: "core" },
  ];

  const toolsNav = [
    { name: "AI Chat", href: "/ai-chat", icon: Bot },
    { name: "Channels", href: "/channels", icon: Plug },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  const handleLogout = () => {
    clearToken();
    window.location.reload();
  };

  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* Sidebar */}
      <div className="w-64 flex flex-col border-r bg-sidebar text-sidebar-foreground shrink-0">
        <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
          <div className="h-8 w-8 bg-primary rounded-md flex items-center justify-center text-primary-foreground font-bold text-sm">
            H
          </div>
          <span className="font-bold text-lg tracking-tight">HiraCRM</span>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-3 py-2">Core</p>
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.name} href={item.href}>
                <div
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                  data-testid={`nav-${item.name.toLowerCase()}`}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="text-sm">{item.name}</span>
                </div>
              </Link>
            );
          })}

          <p className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-3 py-2 mt-3">Tools</p>
          {toolsNav.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.name} href={item.href}>
                <div
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                  data-testid={`nav-${item.name.toLowerCase().replace(" ", "-")}`}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="text-sm">{item.name}</span>
                </div>
              </Link>
            );
          })}
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
        <header className="h-14 border-b bg-card flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="text-foreground font-medium">
                {[...navigation, ...toolsNav].find((n) => n.href === location)?.name ?? "HiraCRM"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Online
            </div>
            <Button variant="ghost" size="icon" className="relative text-muted-foreground h-8 w-8">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 bg-destructive rounded-full" />
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
