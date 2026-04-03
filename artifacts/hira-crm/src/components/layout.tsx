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
  Search
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Inbox", href: "/inbox", icon: Inbox },
    { name: "Customers", href: "/customers", icon: Users },
    { name: "Campaigns", href: "/campaigns", icon: Megaphone },
    { name: "Analytics", href: "/analytics", icon: LineChart },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* Sidebar */}
      <div className="w-64 flex flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
          <div className="h-8 w-8 bg-primary rounded-md flex items-center justify-center text-primary-foreground font-bold">
            H
          </div>
          <span className="font-bold text-lg tracking-tight">HiraCRM</span>
        </div>

        <nav className="flex-1 p-4 space-y-1">
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
                  <item.icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border flex items-center gap-3">
          <Avatar className="h-9 w-9 border border-sidebar-border">
            <AvatarImage src="https://i.pravatar.cc/150?u=a042581f4e29026704d" />
            <AvatarFallback>A</AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate">Agent Smith</p>
            <p className="text-xs text-sidebar-foreground/60 truncate">Lead Support</p>
          </div>
          <Button variant="ghost" size="icon" className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b bg-card flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-96">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search conversations, customers..."
                className="pl-9 bg-muted/50 border-none h-9"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" className="hidden md:flex gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              Available
            </Button>
            <Button variant="ghost" size="icon" className="relative text-muted-foreground">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 h-2 w-2 bg-destructive rounded-full border-2 border-card"></span>
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
