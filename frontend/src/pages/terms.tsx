import { useEffect, useState } from "react";
import { Link } from "wouter";
import { apiFetch } from "@/lib/utils";
import { useAppSettings } from "@/hooks/use-app-settings";
import { BrandMark } from "@/components/brand-mark";
import { FullPageLoader } from "@/components/shared";
import { ScrollText, ArrowLeft } from "lucide-react";

export default function Terms() {
  const { settings } = useAppSettings();
  const [loading, setLoading] = useState(true);
  const [published, setPublished] = useState(false);
  const [content, setContent] = useState("");
  const [version, setVersion] = useState<number>(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch("/api/legal/terms");
        const data = await r.json();
        setPublished(!!data.published);
        setContent(data.content ?? "");
        setVersion(data.version ?? 0);
        setUpdatedAt(data.updatedAt ?? null);
      } catch {
        setPublished(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <FullPageLoader />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <BrandMark logoUrl={settings.logoUrl} letter={settings.logoLetter} companyName={settings.companyName} size="sm" />
          <span className="font-bold text-lg tracking-tight">{settings.companyName}</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ScrollText className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-3xl font-bold font-display tracking-tight">Terms &amp; Conditions</h1>
        </div>
        {published && (
          <p className="text-sm text-muted-foreground mb-8">
            Version {version}
            {updatedAt && <> · Last updated {new Date(updatedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</>}
          </p>
        )}

        {published ? (
          <div className="whitespace-pre-wrap leading-relaxed text-foreground/90 text-[15px]">{content}</div>
        ) : (
          <div className="rounded-xl border border-border bg-muted/30 p-8 text-center text-muted-foreground">
            The Terms &amp; Conditions have not been published yet. Please check back later.
          </div>
        )}

        <div className="mt-12 pt-6 border-t border-border">
          <Link href="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to sign in
          </Link>
        </div>
      </main>
    </div>
  );
}
