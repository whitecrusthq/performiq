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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Paintbrush, Type, Check, Image as ImageIcon, Upload, Trash2, LogIn } from "lucide-react";
import { BrandMark, resolveLogoUrl } from "@/components/brand-mark";

function authHeader(): HeadersInit {
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
  const [logoUrl, setLogoUrl] = useState<string | null>(settings.logoUrl);
  const [selectedTheme, setSelectedTheme] = useState(settings.themeName);
  const [loginHeadline, setLoginHeadline] = useState(settings.loginHeadline);
  const [loginSubtext, setLoginSubtext] = useState(settings.loginSubtext);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setCompanyName(settings.companyName);
    setLogoLetter(settings.logoLetter);
    setLogoUrl(settings.logoUrl);
    setSelectedTheme(settings.themeName);
    setLoginHeadline(settings.loginHeadline);
    setLoginSubtext(settings.loginSubtext);
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
          logoUrl: logoUrl,
          primaryHsl: previewTheme.hsl,
          themeName: previewTheme.name,
          loginHeadline: loginHeadline.slice(0, 200),
          loginSubtext: loginSubtext.slice(0, 400),
        }),
      }).then(r => r.ok ? r.json() : r.json().then((e: any) => Promise.reject(e.error))),
    onSuccess: () => {
      reload();
      toast({ title: "Appearance saved", description: "Your branding settings have been applied." });
    },
    onError: (e: any) => toast({ title: "Error", description: String(e), variant: "destructive" }),
  });

  async function handleLogoFile(file: File) {
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Invalid file", description: "Please choose a PNG, JPG, SVG, or WebP image.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Logo must be 2 MB or smaller.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
      });
      if (!dataUrl.startsWith("data:image/")) throw new Error("File is not a valid image");
      setLogoUrl(dataUrl);
      toast({ title: "Logo loaded", description: "Click \"Save Appearance\" to apply it." });
    } catch (e: any) {
      toast({ title: "Upload failed", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  function clearLogo() {
    setLogoUrl(null);
    toast({ title: "Logo removed", description: "Click \"Save Appearance\" to apply." });
  }

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
            <div className="shadow-md">
              <BrandMark
                logoUrl={logoUrl}
                letter={logoLetterDisplay}
                companyName={companyName}
                size="lg"
                fallbackBg={previewTheme.preview}
              />
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
                <p className="text-xs text-muted-foreground">1–3 characters shown when no logo image is uploaded</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Logo Image
          </CardTitle>
          <CardDescription>Upload a square logo (PNG, JPG, SVG or WebP, up to 2&nbsp;MB). Replaces the letter in the sidebar.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center overflow-hidden shrink-0 border border-border">
              {(() => {
                const resolved = resolveLogoUrl(logoUrl);
                return resolved ? (
                  <img src={resolved} alt="Current logo" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <ImageIcon className="h-7 w-7 text-muted-foreground" />
                );
              })()}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Label htmlFor="logo-file" className="cursor-pointer">
                  <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                    <Upload className="h-4 w-4" />
                    {uploading ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
                  </span>
                  <input
                    id="logo-file"
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="hidden"
                    disabled={uploading}
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) handleLogoFile(f);
                      e.target.value = "";
                    }}
                  />
                </Label>
                {logoUrl && (
                  <Button variant="outline" size="sm" onClick={clearLogo} disabled={uploading}>
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                A square image works best. After uploading, click <strong>Save Appearance</strong> to apply.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogIn className="h-5 w-5" />
            Sign-in Page Text
          </CardTitle>
          <CardDescription>The headline and subtext shown on the marketing panel of the sign-in page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="login-headline">Headline</Label>
            <Textarea
              id="login-headline"
              value={loginHeadline}
              onChange={e => setLoginHeadline(e.target.value)}
              placeholder="Elevate Your Team's Performance."
              maxLength={200}
              rows={2}
            />
            <p className="text-xs text-muted-foreground">{loginHeadline.length}/200 characters</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="login-subtext">Subtext</Label>
            <Textarea
              id="login-subtext"
              value={loginSubtext}
              onChange={e => setLoginSubtext(e.target.value)}
              placeholder="A short tagline that appears under the headline."
              maxLength={400}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">{loginSubtext.length}/400 characters</p>
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
        <Button onClick={() => save.mutate()} disabled={save.isPending || uploading}>
          {save.isPending ? "Saving…" : uploading ? "Waiting for upload…" : "Save Appearance"}
        </Button>
      </div>
    </div>
  );
}
