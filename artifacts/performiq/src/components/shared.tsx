import { ReactNode } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Loader2, ChevronLeft } from "lucide-react";

export function PageHeader({ title, description, children }: { title: string, description?: string, children?: ReactNode }) {
  const canGoBack = typeof window !== "undefined" && window.history.length > 1;
  return (
    <div className="flex flex-col gap-2 mb-8">
      {canGoBack && (
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit -ml-1 group"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back
        </button>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{title}</h1>
          {description && <p className="text-muted-foreground mt-1 text-sm md:text-base">{description}</p>}
        </div>
        {children && <div className="flex items-center gap-3">{children}</div>}
      </div>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode, className?: string }) {
  return (
    <div className={`bg-card rounded-2xl border border-border shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md ${className}`}>
      {children}
    </div>
  );
}

export function StatusBadge({ status, type = "default" }: { status: string, type?: "appraisal" | "goal" | "cycle" }) {
  let colorClass = "bg-gray-100 text-gray-700 border-gray-200";
  
  if (type === "appraisal") {
    switch (status) {
      case "pending": colorClass = "bg-slate-100 text-slate-700 border-slate-200"; break;
      case "self_review": colorClass = "bg-amber-100 text-amber-700 border-amber-200"; break;
      case "manager_review": colorClass = "bg-blue-100 text-blue-700 border-blue-200"; break;
      case "pending_approval": colorClass = "bg-purple-100 text-purple-700 border-purple-200"; break;
      case "completed": colorClass = "bg-emerald-100 text-emerald-700 border-emerald-200"; break;
    }
  } else if (type === "goal") {
    switch (status) {
      case "not_started": colorClass = "bg-slate-100 text-slate-700 border-slate-200"; break;
      case "in_progress": colorClass = "bg-blue-100 text-blue-700 border-blue-200"; break;
      case "completed": colorClass = "bg-emerald-100 text-emerald-700 border-emerald-200"; break;
      case "cancelled": colorClass = "bg-red-100 text-red-700 border-red-200"; break;
    }
  } else if (type === "cycle") {
    switch (status) {
      case "draft": colorClass = "bg-slate-100 text-slate-700 border-slate-200"; break;
      case "active": colorClass = "bg-emerald-100 text-emerald-700 border-emerald-200"; break;
      case "closed": colorClass = "bg-slate-800 text-slate-100 border-slate-900"; break;
    }
  }

  const formattedStatus = status.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase());

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${colorClass}`}>
      {formattedStatus}
    </span>
  );
}

export function Button({ 
  children, variant = "primary", className = "", isLoading = false, ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive", isLoading?: boolean }) {
  const baseClass = "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none active:scale-[0.98]";
  
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    outline: "border-2 border-border bg-transparent hover:bg-muted text-foreground",
    ghost: "bg-transparent hover:bg-muted text-foreground",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button className={`${baseClass} ${variants[variant]} ${sizes.md} ${className}`} disabled={isLoading || props.disabled} {...props}>
      {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {children}
    </button>
  );
}

export function Input({ className = "", error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return (
    <div className="w-full">
      <input 
        className={`w-full px-4 py-2.5 rounded-xl bg-background border ${error ? 'border-destructive focus:ring-destructive/20' : 'border-border focus:border-primary focus:ring-primary/20'} focus:outline-none focus:ring-4 transition-all duration-200 text-foreground placeholder:text-muted-foreground ${className}`}
        {...props} 
      />
      {error && <p className="mt-1.5 text-sm text-destructive font-medium">{error}</p>}
    </div>
  );
}

export function Label({ children, className = "" }: { children: ReactNode, className?: string }) {
  return (
    <label className={`block text-sm font-semibold text-foreground mb-1.5 ${className}`}>
      {children}
    </label>
  );
}

export function FullPageLoader() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background">
      <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
      <p className="text-muted-foreground font-medium animate-pulse">Loading PerformIQ...</p>
    </div>
  );
}

export function EmptyState({ title, description, icon: Icon, action }: { title: string, description: string, icon: any, action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-muted/30 rounded-2xl border border-dashed border-border">
      <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center shadow-sm border border-border mb-4">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-muted-foreground max-w-md">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
