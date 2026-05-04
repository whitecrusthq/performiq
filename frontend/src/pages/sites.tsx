import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader, Card, Button, Input, Label } from "@/components/shared";
import { MapPin, Plus, Edit, Trash2, X, AlertCircle, Globe, ShieldCheck, Upload, Download, FileUp, CheckCircle2, XCircle } from "lucide-react";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/utils";

const SITE_IMPORT_HEADERS = ["name", "address", "city", "region", "country", "description", "require2Fa"];

const SITE_FIELD_MAP: Record<string, string> = {
  "name": "name", "site name": "name", "site": "name",
  "address": "address", "street": "address", "street address": "address",
  "city": "city", "town": "city",
  "region": "region", "state": "region", "state/province": "region", "province": "region",
  "country": "country",
  "description": "description", "notes": "description",
  "require2fa": "require2Fa", "require 2fa": "require2Fa", "2fa": "require2Fa", "two factor": "require2Fa",
};

function parseSiteCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const splitLine = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') q = !q;
      else if (ch === "," && !q) { out.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  const headers = splitLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = splitLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      const key = SITE_FIELD_MAP[h.toLowerCase()] ?? h;
      if (vals[i]) obj[key] = vals[i];
    });
    return obj;
  });
}

function BulkImportSitesModal({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const [step, setStep] = useState<"upload" | "preview" | "results">("upload");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const downloadTemplate = () => {
    const csv = SITE_IMPORT_HEADERS.join(",") +
      "\nHead Office,123 Marina Road,Lagos,Lagos,Nigeria,Main HQ branch,false" +
      "\nAbuja Branch,Plot 42 Wuse Zone 5,Abuja,FCT,Nigeria,Northern regional office,true\n";
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "sites-import-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (file: File) => {
    setError(null);
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a CSV file.");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseSiteCSV(text);
      if (parsed.length === 0) {
        setError("No data rows found in the CSV.");
        return;
      }
      setRows(parsed);
      setStep("preview");
    };
    reader.readAsText(file);
  };

  const runImport = async () => {
    setImporting(true);
    setError(null);
    try {
      const r = await apiFetch("/api/sites/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sites: rows }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error || "Import failed.");
        return;
      }
      setResults(data);
      setStep("results");
      if (data.succeeded > 0) onComplete();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  const validRows = rows.filter(r => r.name?.trim());
  const invalidRows = rows.filter(r => !r.name?.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FileUp className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">Bulk Import Sites</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === "upload" && (
            <div className="space-y-6">
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Upload CSV File</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Required column: <strong>name</strong>. Optional: address, city, region, country, description, require2Fa.
                  </p>
                </div>
              </div>

              <label className="flex flex-col items-center gap-3 px-6 py-8 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 cursor-pointer transition-colors">
                <Upload className="w-6 h-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Click to select CSV file</span>
                <input type="file" className="hidden" accept=".csv"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
                />
              </label>

              <div className="bg-muted/30 rounded-xl p-4 space-y-2">
                <h4 className="text-sm font-semibold">Need a template?</h4>
                <p className="text-xs text-muted-foreground">
                  Download a CSV template with all supported columns and two example rows.
                  Set <code className="bg-muted px-1 rounded">require2Fa</code> to <code className="bg-muted px-1 rounded">true</code> or <code className="bg-muted px-1 rounded">false</code>.
                </p>
                <button onClick={downloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors">
                  <Download className="w-3.5 h-3.5" /> Download Template
                </button>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span>
                </div>
              )}
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Preview Import — {fileName}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {rows.length} row{rows.length !== 1 ? "s" : ""} found —
                    <span className="text-green-600 font-medium"> {validRows.length} valid</span>
                    {invalidRows.length > 0 && <span className="text-red-600 font-medium">, {invalidRows.length} missing name</span>}
                  </p>
                </div>
                <button onClick={() => { setStep("upload"); setRows([]); }}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors">
                  Change File
                </button>
              </div>

              <div className="border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold">#</th>
                        <th className="text-left px-3 py-2 font-semibold">Name</th>
                        <th className="text-left px-3 py-2 font-semibold">City</th>
                        <th className="text-left px-3 py-2 font-semibold">Country</th>
                        <th className="text-left px-3 py-2 font-semibold">2FA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className={`border-t border-border ${!r.name?.trim() ? "bg-red-50 dark:bg-red-950/20" : ""}`}>
                          <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                          <td className="px-3 py-2 font-medium">{r.name || <span className="text-red-600">missing</span>}</td>
                          <td className="px-3 py-2">{r.city || "—"}</td>
                          <td className="px-3 py-2">{r.country || "—"}</td>
                          <td className="px-3 py-2">{["true", "yes", "y", "1"].includes((r.require2Fa ?? "").toLowerCase()) ? "Yes" : "No"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span>
                </div>
              )}
            </div>
          )}

          {step === "results" && results && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-border p-4 text-center">
                  <p className="text-2xl font-bold">{results.total}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
                </div>
                <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/20 p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{results.succeeded}</p>
                  <p className="text-xs text-green-700 uppercase tracking-wide">Imported</p>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 p-4 text-center">
                  <p className="text-2xl font-bold text-red-600">{results.failed}</p>
                  <p className="text-xs text-red-700 uppercase tracking-wide">Failed</p>
                </div>
              </div>

              <div className="border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold">#</th>
                        <th className="text-left px-3 py-2 font-semibold">Status</th>
                        <th className="text-left px-3 py-2 font-semibold">Name</th>
                        <th className="text-left px-3 py-2 font-semibold">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.results.map((r: any) => (
                        <tr key={r.row} className="border-t border-border">
                          <td className="px-3 py-2 text-muted-foreground">{r.row}</td>
                          <td className="px-3 py-2">
                            {r.status === "success" ? (
                              <span className="inline-flex items-center gap-1 text-green-600 font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> OK</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-red-600 font-medium"><XCircle className="w-3.5 h-3.5" /> Error</span>
                            )}
                          </td>
                          <td className="px-3 py-2">{r.name || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{r.error || "Imported"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          {step === "preview" && (
            <button onClick={runImport} disabled={importing || validRows.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {importing ? "Importing…" : <><Upload className="w-4 h-4" /> Import {validRows.length} Site{validRows.length !== 1 ? "s" : ""}</>}
            </button>
          )}
          {step === "results" && (
            <button onClick={onClose}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
              Done
            </button>
          )}
          {step !== "results" && (
            <button onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface Site {
  id: number;
  name: string;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  description?: string | null;
  require2Fa?: boolean;
  createdAt: string;
}

function useSites() {
  const [sites, setSites] = useState<Site[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const r = await apiFetch("/api/sites");
      const data = await r.json();
      if (Array.isArray(data)) setSites(data);
    } finally {
      setIsLoading(false);
    }
  };

  useState(() => { refresh(); });

  return { sites, isLoading, refresh };
}

const EMPTY_FORM = { name: "", address: "", city: "", region: "", country: "", description: "", require2Fa: false };

export default function Sites() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { sites, isLoading, refresh } = useSites();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);

  const openCreate = () => {
    setFormData(EMPTY_FORM);
    setEditingId(null);
    setError(null);
    setIsDialogOpen(true);
  };

  const openEdit = (site: Site) => {
    setFormData({ name: site.name, address: site.address || "", city: site.city || "", region: site.region || "", country: site.country || "", description: site.description || "", require2Fa: !!site.require2Fa });
    setEditingId(site.id);
    setError(null);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      const url = editingId ? `/api/sites/${editingId}` : "/api/sites";
      const method = editingId ? "PUT" : "POST";
      const r = await apiFetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
      const data = await r.json();
      if (!r.ok) { setError(data.error || "Failed to save site."); return; }
      await refresh();
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      setIsDialogOpen(false);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete site "${name}"? Users assigned to this site will be unlinked.`)) return;
    try {
      await apiFetch(`/api/sites/${id}`, { method: "DELETE" });
      await refresh();
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
    } catch {
      alert("Failed to delete site.");
    }
  };

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toggleSelect = (id: number) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (selectedIds.size === sites.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(sites.map(s => s.id)));
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} selected site(s)? Users assigned to them will be unlinked.`)) return;
    setBulkDeleting(true);
    await Promise.all([...selectedIds].map(id => apiFetch(`/api/sites/${id}`, { method: "DELETE" })));
    await refresh();
    queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
    setSelectedIds(new Set());
    setBulkDeleting(false);
  };

  const effectiveLevel = (user as any)?.customRole?.permissionLevel ?? user?.role;
  if (effectiveLevel !== "admin" && effectiveLevel !== "super_admin") {
    return <div className="p-8 text-destructive">Unauthorized</div>;
  }

  return (
    <div>
      <PageHeader title="Sites" description="Manage physical locations and offices.">
        <Button variant="outline" onClick={() => setShowBulkImport(true)}>
          <FileUp className="w-4 h-4 mr-2" /> Bulk Import
        </Button>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Add Site
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="p-8 text-muted-foreground text-sm">Loading sites...</div>
      ) : sites.length === 0 ? (
        <Card className="p-12 text-center">
          <MapPin className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground font-medium">No sites yet</p>
          <p className="text-sm text-muted-foreground mt-1">Add your first site to start assigning users to locations.</p>
          <Button className="mt-4" onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Add Site</Button>
        </Card>
      ) : (
        <>
          <BulkActionBar count={selectedIds.size} onDelete={handleBulkDelete} onClear={() => setSelectedIds(new Set())} deleting={bulkDeleting} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sites.map(site => (
              <Card key={site.id} className={`p-5 flex flex-col gap-3 ${selectedIds.has(site.id) ? "ring-2 ring-primary/30" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(site.id)}
                      onChange={() => toggleSelect(site.id)}
                      className="mt-1 w-4 h-4 accent-primary cursor-pointer shrink-0"
                    />
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{site.name}</p>
                        {(site.city || site.region || site.country) && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Globe className="w-3 h-3" />
                            {[site.city, site.region, site.country].filter(Boolean).join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(site)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(site.id, site.name)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {site.address && <p className="text-sm text-muted-foreground">{site.address}</p>}
                {site.description && <p className="text-sm text-muted-foreground italic">{site.description}</p>}
                {site.require2Fa && (
                  <div className="inline-flex items-center gap-1.5 self-start rounded-full bg-primary/10 text-primary text-xs font-medium px-2.5 py-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> 2FA required
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center p-6 pb-4">
              <h2 className="text-xl font-bold">{editingId ? "Edit Site" : "Add Site"}</h2>
              <button onClick={() => setIsDialogOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 px-6 pb-6">
              <div><Label>Site Name <span className="text-destructive">*</span></Label><Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required placeholder="e.g. Head Office" /></div>
              <div><Label>Address</Label><Input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Street address" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>City</Label><Input value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} placeholder="City" /></div>
                <div><Label>Region</Label><Input value={formData.region} onChange={e => setFormData({ ...formData, region: e.target.value })} placeholder="e.g. West Africa, South East" /></div>
              </div>
              <div><Label>Country</Label><Input value={formData.country} onChange={e => setFormData({ ...formData, country: e.target.value })} placeholder="Country" /></div>
              <div><Label>Description</Label><Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Optional notes" /></div>
              <label className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-border accent-primary cursor-pointer"
                  checked={!!formData.require2Fa}
                  onChange={e => setFormData({ ...formData, require2Fa: e.target.checked })}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-medium"><ShieldCheck className="w-4 h-4 text-primary" /> Require two-factor authentication for users at this site</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Every user assigned to this site will be forced to set up an authenticator app on their next sign-in.</div>
                </div>
              </label>
              {error && (
                <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span>
                </div>
              )}
              <Button className="w-full mt-2" type="submit" isLoading={isSaving}>Save Site</Button>
            </form>
          </Card>
        </div>
      )}

      {showBulkImport && (
        <BulkImportSitesModal
          onClose={() => setShowBulkImport(false)}
          onComplete={() => { refresh(); queryClient.invalidateQueries({ queryKey: ["/api/sites"] }); }}
        />
      )}
    </div>
  );
}
