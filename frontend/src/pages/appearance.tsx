import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useAppSettings } from "@/hooks/use-app-settings";
import { PageHeader } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Paintbrush, Type, Check } from "lucide-react";

function authHeader() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const THEMES = [
  { name: "blue",   label: "Blue",    hsl: "221 83% 53%",  preview: "#3b82f6" },
  { name: "indigo", label: "Indigo",  hsl: "243 75% 59%",  preview: "#6366f1" },
  { name: "purple", label: "Purple",  hsl: "270 75% 60%",  preview: "#a855f7" },
  { name: "rose",   label: "Rose",    hsl: "347 77% 50%",  preview: "#f43f5e" },
  { name: "orange", label: "Orange",  hsl: "25 95% 53%",   preview: "#f97316" },
  { name: "amber",  label: "Amber",   hsl: "38 92% 50%",   preview: "#f59e0b" },
  { name: "green",  label: "Green",   hsl: "142 71% 45%",  preview: "#22c55e" },
  { name: "teal",   label: "Teal",    hsl: "172 66% 40%",  preview: "#14b8a6" },
  { name: "cyan",   label: "Cyan",    hsl: "192 82% 45%",  preview: "#06b6d4" },
  { name: "slate",  label: "Slate",   hsl: "215 25% 42%",  preview: "#64748b" },
];

export default function Appearance() {
  const { user } = useAuth();
  const { settings, reload } = useAppSettings();
  const { toast } = useToast();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  const [companyName, setCompanyName] = useState(settings.companyName);
  const [logoLetter, setLogoLetter] = useState(settings.logoLetter);
  const [selectedTheme, setSelectedTheme] = useState(settings.themeName);

  useEffect(() => {
    setCompanyName(settings.companyName);
    setLogoLetter(settings.logoLetter);
    setSelectedTheme(settings.themeName);
  }, [settings]);

  const previewTheme = THEMES.find(t => t.name === selectedTheme) ?? THEMES[0];

  const save = useMutation({
    mutationFn: () =>
      apiFetch("/api/app-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          companyName: companyName.trim() || "PerformIQ",
          logoLetter: (logoLetter.trim() || "P").slice(0, 3).toUpperCase(),
          primaryHsl: previewTheme.hsl,
          themeName: previewTheme.name,
        }),
      }).then(r => r.ok ? r.json() : r.json().then((e: any) => Promise.reject(e.error))),
    onSuccess: () => {
      reload();
      toast({ title: "Appearance saved", description: "Your branding settings have been applied." });
    },
    onError: (e: any) => toast({ title: "Error", description: String(e), variant: "destructive" }),
  });

  if (!isAdmin) {
    return <div className="p-8 text-center text-muted-foreground">You do not have permission to view this page.</div>;
  }

  const logoLetterDisplay = (logoLetter.trim() || "P").slice(0, 3).toUpperCase();

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <PageHeader
        title="Appearance"
        description="Customise your company branding and colour theme across the app."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="h-5 w-5" />
            Company Branding
          </CardTitle>
          <CardDescription>The name and logo shown in the sidebar on every page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-5">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl shrink-0 shadow-md transition-all"
              style={{ backgroundColor: previewTheme.preview }}
            >
              {logoLetterDisplay}
            </div>
            <div className="flex-1 space-y-3">
              <div className="space-y-1">
                <Label htmlFor="company-name">Company name</Label>
                <Input
                  id="company-name"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="PerformIQ"
                  maxLength={60}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="logo-letter">Logo letter(s)</Label>
                <Input
                  id="logo-letter"
                  value={logoLetter}
                  onChange={e => setLogoLetter(e.target.value.toUpperCase().slice(0, 3))}
                  placeholder="P"
                  maxLength={3}
                  className="w-24"
                />
                <p className="text-xs text-muted-foreground">1–3 characters shown in the sidebar icon</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Paintbrush className="h-5 w-5" />
            Colour Theme
          </CardTitle>
          <CardDescription>Choose the accent colour used for buttons, active links, and highlights.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-3">
            {THEMES.map(theme => (
              <button
                key={theme.name}
                title={theme.label}
                onClick={() => setSelectedTheme(theme.name)}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all hover:scale-105"
                style={{
                  borderColor: selectedTheme === theme.name ? theme.preview : "transparent",
                  backgroundColor: selectedTheme === theme.name ? `${theme.preview}15` : undefined,
                }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shadow-sm"
                  style={{ backgroundColor: theme.preview }}
                >
                  {selectedTheme === theme.name && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
                </div>
                <span className="text-xs font-medium">{theme.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pt-1">
        <p className="text-sm text-muted-foreground">
          Preview: sidebar icon will show <strong>{logoLetterDisplay}</strong> in <strong>{previewTheme.label}</strong>
        </p>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save Appearance"}
        </Button>
      </div>
    </div>
  );
}
