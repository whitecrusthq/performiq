import { useEffect, useState } from "react";
import { PageHeader, Card, Button, Label } from "@/components/shared";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from "@/lib/utils";
import { ShieldCheck, ScrollText, ExternalLink, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface LegalAdmin {
  privacyContent: string;
  privacyPublished: boolean;
  privacyUpdatedAt: string | null;
  termsContent: string;
  termsVersion: number;
  termsPublished: boolean;
  termsUpdatedAt: string | null;
}

type SaveState = "idle" | "saving" | "success" | "error";

export default function Legal() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [privacyContent, setPrivacyContent] = useState("");
  const [privacyPublished, setPrivacyPublished] = useState(false);
  const [privacyState, setPrivacyState] = useState<SaveState>("idle");

  const [termsContent, setTermsContent] = useState("");
  const [termsPublished, setTermsPublished] = useState(false);
  const [termsVersion, setTermsVersion] = useState(0);
  const [termsState, setTermsState] = useState<SaveState>("idle");

  async function load() {
    try {
      const r = await apiFetch("/api/legal/admin");
      if (!r.ok) throw new Error();
      const d: LegalAdmin = await r.json();
      setPrivacyContent(d.privacyContent ?? "");
      setPrivacyPublished(!!d.privacyPublished);
      setTermsContent(d.termsContent ?? "");
      setTermsPublished(!!d.termsPublished);
      setTermsVersion(d.termsVersion ?? 0);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function savePrivacy() {
    setPrivacyState("saving");
    try {
      const r = await apiFetch("/api/legal/privacy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: privacyContent, published: privacyPublished }),
      });
      if (!r.ok) throw new Error();
      setPrivacyState("success");
      setTimeout(() => setPrivacyState("idle"), 2500);
    } catch {
      setPrivacyState("error");
    }
  }

  async function saveTerms() {
    setTermsState("saving");
    try {
      const r = await apiFetch("/api/legal/terms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: termsContent, published: termsPublished }),
      });
      if (!r.ok) throw new Error();
      const d: LegalAdmin = await r.json();
      setTermsVersion(d.termsVersion ?? 0);
      setTermsState("success");
      setTimeout(() => setTermsState("idle"), 2500);
    } catch {
      setTermsState("error");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Legal & Compliance"
        description="Author your Privacy Policy and Terms & Conditions. Publishing makes them live; updating published Terms forces all users to re-accept on next login."
      />

      {loadError && (
        <div className="bg-destructive/10 border-l-4 border-destructive text-destructive p-4 rounded-r-xl mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm font-medium">Failed to load legal content. Please refresh and try again.</p>
        </div>
      )}

      {/* Privacy Policy */}
      <Card className="p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Privacy Policy</h3>
              <p className="text-sm text-muted-foreground">Shown on a public, shareable page.</p>
            </div>
          </div>
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline shrink-0"
          >
            View public page <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <Label>Content</Label>
        <Textarea
          value={privacyContent}
          onChange={(e) => setPrivacyContent(e.target.value)}
          placeholder="Write or paste your privacy policy here…"
          className="min-h-[260px] font-mono text-sm"
        />

        <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <Switch checked={privacyPublished} onCheckedChange={setPrivacyPublished} />
            <span className="text-sm font-medium">
              {privacyPublished ? "Published (publicly visible)" : "Draft (hidden from public)"}
            </span>
          </label>
          <div className="flex items-center gap-3">
            {privacyState === "success" && (
              <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" /> Saved
              </span>
            )}
            {privacyState === "error" && (
              <span className="inline-flex items-center gap-1.5 text-sm text-destructive">
                <AlertCircle className="w-4 h-4" /> Failed to save
              </span>
            )}
            <Button onClick={savePrivacy} isLoading={privacyState === "saving"}>Save Privacy Policy</Button>
          </div>
        </div>
      </Card>

      {/* Terms & Conditions */}
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <ScrollText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Terms &amp; Conditions</h3>
              <p className="text-sm text-muted-foreground">
                Current version: <span className="font-semibold text-foreground">{termsVersion === 0 ? "—" : `v${termsVersion}`}</span>
              </p>
            </div>
          </div>
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline shrink-0"
          >
            View public page <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <Label>Content</Label>
        <Textarea
          value={termsContent}
          onChange={(e) => setTermsContent(e.target.value)}
          placeholder="Write or paste your terms & conditions here…"
          className="min-h-[260px] font-mono text-sm"
        />

        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 p-3 rounded-lg mt-4 flex items-start gap-2.5 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>Saving published Terms with changed content increases the version and requires <strong>every user</strong> to accept again at their next login.</p>
        </div>

        <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <Switch checked={termsPublished} onCheckedChange={setTermsPublished} />
            <span className="text-sm font-medium">
              {termsPublished ? "Published (enforced at login)" : "Draft (not enforced)"}
            </span>
          </label>
          <div className="flex items-center gap-3">
            {termsState === "success" && (
              <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" /> Saved
              </span>
            )}
            {termsState === "error" && (
              <span className="inline-flex items-center gap-1.5 text-sm text-destructive">
                <AlertCircle className="w-4 h-4" /> Failed to save
              </span>
            )}
            <Button onClick={saveTerms} isLoading={termsState === "saving"}>Save Terms &amp; Conditions</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
