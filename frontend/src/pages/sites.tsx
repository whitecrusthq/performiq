import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader, Card, Button, Input, Label } from "@/components/shared";
import { MapPin, Plus, Edit, Trash2, X, AlertCircle, Globe } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/utils";

interface Site {
  id: number;
  name: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  description?: string | null;
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

const EMPTY_FORM = { name: "", address: "", city: "", country: "", description: "" };

export default function Sites() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { sites, isLoading, refresh } = useSites();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setFormData(EMPTY_FORM);
    setEditingId(null);
    setError(null);
    setIsDialogOpen(true);
  };

  const openEdit = (site: Site) => {
    setFormData({ name: site.name, address: site.address || "", city: site.city || "", country: site.country || "", description: site.description || "" });
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

  if (user?.role !== "admin" && user?.role !== "super_admin") {
    return <div className="p-8 text-destructive">Unauthorized</div>;
  }

  return (
    <div>
      <PageHeader title="Sites" description="Manage physical locations and offices.">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sites.map(site => (
            <Card key={site.id} className="p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{site.name}</p>
                    {(site.city || site.country) && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Globe className="w-3 h-3" />
                        {[site.city, site.country].filter(Boolean).join(", ")}
                      </p>
                    )}
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
            </Card>
          ))}
        </div>
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
                <div><Label>Country</Label><Input value={formData.country} onChange={e => setFormData({ ...formData, country: e.target.value })} placeholder="Country" /></div>
              </div>
              <div><Label>Description</Label><Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Optional notes" /></div>
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
    </div>
  );
}
