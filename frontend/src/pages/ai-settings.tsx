import { useEffect, useState } from "react";
import { PageHeader, Card, Button, Input, Label } from "@/components/shared";
import { apiFetch } from "@/lib/utils";
import { Sparkles, Key, CheckCircle2, AlertCircle, Eye, EyeOff, ExternalLink } from "lucide-react";

interface AiSettingsResponse {
  provider: string;
  model: string;
  hasKey: boolean;
  maskedKey: string;
  updatedAt: string;
  providers: string[];
  geminiModels: string[];
}

export default function AiSettings() {
  const [data, setData] = useState<AiSettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [provider, setProvider] = useState("gemini");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [editingKey, setEditingKey] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch("/api/ai-settings");
      if (!r.ok) { setError("Could not load settings"); return; }
      const d = await r.json();
      setData(d);
      setProvider(d.provider);
      setModel(d.model);
      setApiKey("");
      setEditingKey(false);
    } finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);

  async function save() {
    setSaving(true); setError(null); setTestResult(null);
    const body: any = { provider, model };
    if (editingKey) body.apiKey = apiKey;
    const r = await apiFetch("/api/ai-settings", { method: "PUT", body: JSON.stringify(body) });
    setSaving(false);
    if (!r.ok) { setError((await r.json()).error ?? "Save failed"); return; }
    refresh();
  }

  async function clearKey() {
    if (!confirm("Remove the saved API key?")) return;
    setSaving(true); setError(null); setTestResult(null);
    const r = await apiFetch("/api/ai-settings", { method: "PUT", body: JSON.stringify({ clearKey: true }) });
    setSaving(false);
    if (!r.ok) { setError((await r.json()).error ?? "Failed"); return; }
    refresh();
  }

  async function testIt() {
    setTesting(true); setTestResult(null);
    const r = await apiFetch("/api/ai-settings/test", { method: "POST" });
    setTesting(false);
    if (!r.ok) { setTestResult({ ok: false, message: "Test request failed" }); return; }
    setTestResult(await r.json());
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="AI Assistant" description="Configure the AI provider that powers handbook quiz generation." />
        <Card><p className="text-sm text-muted-foreground">Loading…</p></Card>
      </div>
    );
  }
  if (!data) {
    return (
      <div>
        <PageHeader title="AI Assistant" />
        <Card><p className="text-sm text-destructive">{error ?? "Unable to load settings."}</p></Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="AI Assistant"
        description="Configure the AI provider that powers automatic quiz question generation in the handbook."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <h2 className="font-semibold mb-1 flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Provider</h2>
            <p className="text-sm text-muted-foreground mb-4">Choose which AI service generates quiz questions from your handbook documents.</p>

            <div className="space-y-3">
              <div>
                <Label>Provider</Label>
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm w-full mt-1"
                  value={provider}
                  onChange={e => setProvider(e.target.value)}
                >
                  {data.providers.map(p => (
                    <option key={p} value={p}>{p === "gemini" ? "Google Gemini (own key)" : p}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  More providers (OpenAI, Claude) can be added later. Gemini is the only currently supported option.
                </p>
              </div>

              <div>
                <Label>Model</Label>
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm w-full mt-1"
                  value={model}
                  onChange={e => setModel(e.target.value)}
                >
                  {data.geminiModels.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  <code>gemini-2.5-flash</code> is fast and cheap; <code>gemini-2.5-pro</code> is more capable.
                </p>
              </div>

              <div>
                <Label className="flex items-center gap-1.5"><Key className="h-3.5 w-3.5" /> API key</Label>
                {!editingKey ? (
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1 h-9 rounded-md border border-input bg-muted/30 px-3 text-sm flex items-center font-mono text-muted-foreground">
                      {data.hasKey ? data.maskedKey : "— not set —"}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => { setEditingKey(true); setApiKey(""); }}>
                      {data.hasKey ? "Replace" : "Add key"}
                    </Button>
                    {data.hasKey && (
                      <Button size="sm" variant="outline" onClick={clearKey} disabled={saving}>Remove</Button>
                    )}
                  </div>
                ) : (
                  <div className="mt-1 space-y-2">
                    <div className="relative">
                      <Input
                        type={showKey ? "text" : "password"}
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                        placeholder="Paste your Google AI Studio API key…"
                        className="pr-10 font-mono"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(s => !s)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setEditingKey(false); setApiKey(""); }}>Cancel</Button>
                      <a
                        href="https://aistudio.google.com/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Get a key from Google AI Studio <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Stored in your database and only sent to Google's servers when generating questions. Only admins can view this page.
                </p>
              </div>
            </div>

            {error && <p className="text-sm text-destructive mt-3">{error}</p>}

            <div className="mt-5 flex items-center gap-2">
              <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
              <Button variant="outline" onClick={testIt} disabled={testing || !data.hasKey}>
                {testing ? "Testing…" : "Test connection"}
              </Button>
              {testResult && (
                <span className={`text-sm flex items-center gap-1.5 ${testResult.ok ? "text-emerald-600" : "text-rose-600"}`}>
                  {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  {testResult.message}
                </span>
              )}
            </div>

            <p className="text-xs text-muted-foreground mt-3">
              Last updated: {new Date(data.updatedAt).toLocaleString()}
            </p>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h3 className="font-semibold mb-2">How it's used</h3>
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li>• On the <strong>Handbook</strong> page, admins click <strong>Quiz Q → Generate</strong> on a document.</li>
              <li>• The system sends the document's "quiz reference text" to your chosen model and stores the returned questions.</li>
              <li>• Employees then take quizzes randomly drawn from those questions.</li>
            </ul>
          </Card>
          <Card>
            <h3 className="font-semibold mb-2">Pricing & limits</h3>
            <p className="text-sm text-muted-foreground">
              Costs are billed by Google to the account that owns the API key. <code>gemini-2.5-flash</code> is the cheapest option; switch to <code>gemini-2.5-pro</code> if you need higher-quality questions.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
