import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { apiGet, apiPost, apiPut, apiDelete, getBaseUrl } from "@/lib/api";
import {
  Search, Plus, Package, Plug, Tags, Loader2, Trash2, Edit2,
  RefreshCw, ExternalLink, ArrowUpDown, ChevronLeft, ChevronRight,
  DollarSign, Box, Layers, Wifi, WifiOff, Copy, Check, ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";

interface ProductType {
  id: number;
  externalId: string | null;
  name: string;
  description: string | null;
  sku: string | null;
  price: number;
  currency: string;
  categoryId: number | null;
  imageUrl: string | null;
  stockQty: number | null;
  isActive: boolean;
  metadata: Record<string, unknown> | null;
  sourceId: number | null;
  category?: { id: number; name: string } | null;
  source?: { id: number; name: string } | null;
}

interface Category {
  id: number;
  name: string;
  description: string | null;
}

interface Source {
  id: number;
  name: string;
  type: "api" | "webhook" | "manual";
  apiUrl: string | null;
  apiKey: string | null;
  webhookSecret: string | null;
  headerKey: string | null;
  headerValue: string | null;
  fieldMapping: Record<string, string> | null;
  syncInterval: number | null;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncCount: number | null;
  isActive: boolean;
}

export default function Products() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShoppingBag className="h-6 w-6" /> Product Menu
        </h1>
        <p className="text-muted-foreground mt-1">
          Browse products, manage categories, and connect to your inventory sources
        </p>
      </div>
      <Tabs defaultValue="catalog" className="space-y-4">
        <TabsList>
          <TabsTrigger value="catalog" className="gap-1.5"><Package className="h-4 w-4" /> Catalog</TabsTrigger>
          <TabsTrigger value="categories" className="gap-1.5"><Tags className="h-4 w-4" /> Categories</TabsTrigger>
          <TabsTrigger value="sources" className="gap-1.5"><Plug className="h-4 w-4" /> API Sources</TabsTrigger>
        </TabsList>
        <TabsContent value="catalog"><CatalogTab /></TabsContent>
        <TabsContent value="categories"><CategoriesTab /></TabsContent>
        <TabsContent value="sources"><SourcesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function CatalogTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [editProduct, setEditProduct] = useState<ProductType | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (categoryFilter !== "all") params.set("categoryId", categoryFilter);
  params.set("page", String(page));
  params.set("limit", "20");

  const { data, isLoading } = useQuery({
    queryKey: ["products", search, categoryFilter, page],
    queryFn: () => apiGet<{ products: ProductType[]; total: number; totalPages: number }>(`/products?${params}`),
  });

  const { data: categories } = useQuery({
    queryKey: ["product-categories"],
    queryFn: () => apiGet<Category[]>("/product-categories"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiDelete(`/products/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); toast.success("Product deleted"); },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products by name, SKU, or description..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories?.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setShowAddDialog(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Product
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : !data?.products?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No products found</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Add products manually or connect an API source to sync your inventory</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {data.products.map((p) => (
              <Card key={p.id} className="group hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  {p.imageUrl ? (
                    <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="aspect-square rounded-lg bg-muted/50 flex items-center justify-center">
                      <Package className="h-12 w-12 text-muted-foreground/20" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-sm leading-tight line-clamp-2">{p.name}</h3>
                    {p.sku && <p className="text-xs text-muted-foreground mt-0.5">SKU: {p.sku}</p>}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-primary">
                      {p.currency} {Number(p.price).toFixed(2)}
                    </span>
                    {p.stockQty != null && (
                      <Badge variant={p.stockQty > 0 ? "default" : "destructive"} className="text-xs">
                        {p.stockQty > 0 ? `${p.stockQty} in stock` : "Out of stock"}
                      </Badge>
                    )}
                  </div>
                  {p.category && (
                    <Badge variant="secondary" className="text-xs">{p.category.name}</Badge>
                  )}
                  {p.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                  )}
                  <div className="flex gap-2 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => setEditProduct(p)}>
                      <Edit2 className="h-3 w-3" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => {
                      if (confirm("Delete this product?")) deleteMut.mutate(p.id);
                    }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">Page {page} of {data.totalPages} ({data.total} products)</span>
              <Button size="sm" variant="outline" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {showAddDialog && (
        <ProductDialog
          categories={categories || []}
          onClose={() => setShowAddDialog(false)}
          onSaved={() => { setShowAddDialog(false); qc.invalidateQueries({ queryKey: ["products"] }); }}
        />
      )}
      {editProduct && (
        <ProductDialog
          product={editProduct}
          categories={categories || []}
          onClose={() => setEditProduct(null)}
          onSaved={() => { setEditProduct(null); qc.invalidateQueries({ queryKey: ["products"] }); }}
        />
      )}
    </div>
  );
}

function ProductDialog({
  product,
  categories,
  onClose,
  onSaved,
}: {
  product?: ProductType;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: product?.name || "",
    description: product?.description || "",
    sku: product?.sku || "",
    price: product?.price?.toString() || "0",
    currency: product?.currency || "USD",
    categoryId: product?.categoryId?.toString() || "",
    imageUrl: product?.imageUrl || "",
    stockQty: product?.stockQty?.toString() || "",
    isActive: product?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Product name is required"); return; }
    setSaving(true);
    try {
      const body = {
        name: form.name,
        description: form.description || null,
        sku: form.sku || null,
        price: parseFloat(form.price) || 0,
        currency: form.currency,
        categoryId: form.categoryId ? parseInt(form.categoryId) : null,
        imageUrl: form.imageUrl || null,
        stockQty: form.stockQty ? parseInt(form.stockQty) : null,
        isActive: form.isActive,
      };
      if (product) {
        await apiPut(`/products/${product.id}`, body);
        toast.success("Product updated");
      } else {
        await apiPost("/products", body);
        toast.success("Product added");
      }
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Edit Product" : "Add Product"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Price</Label><Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
            <div><Label>Currency</Label>
              <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["USD", "EUR", "GBP", "NGN", "GHS", "KES", "ZAR", "AED", "INR", "CAD", "AUD"].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
            <div><Label>Stock Quantity</Label><Input type="number" value={form.stockQty} onChange={(e) => setForm({ ...form, stockQty: e.target.value })} /></div>
          </div>
          <div>
            <Label>Category</Label>
            <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Image URL</Label><Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." /></div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
          <div className="flex items-center gap-2">
            <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
            <Label>Active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            {product ? "Update" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoriesTab() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const { data: categories, isLoading } = useQuery({
    queryKey: ["product-categories"],
    queryFn: () => apiGet<Category[]>("/product-categories"),
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (editCat) {
        return apiPut(`/product-categories/${editCat.id}`, { name, description: desc || null });
      }
      return apiPost("/product-categories", { name, description: desc || null });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-categories"] });
      toast.success(editCat ? "Category updated" : "Category added");
      resetForm();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiDelete(`/product-categories/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["product-categories"] }); toast.success("Category deleted"); },
  });

  const resetForm = () => {
    setShowAdd(false);
    setEditCat(null);
    setName("");
    setDesc("");
  };

  const startEdit = (c: Category) => {
    setEditCat(c);
    setName(c.name);
    setDesc(c.description || "");
    setShowAdd(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Organize your products into categories for easy browsing</p>
        <Button onClick={() => { resetForm(); setShowAdd(true); }} className="gap-1.5"><Plus className="h-4 w-4" /> Add Category</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !categories?.length ? (
        <Card><CardContent className="py-12 text-center">
          <Tags className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">No categories yet</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <Card key={c.id} className="group">
              <CardContent className="p-4 flex items-start justify-between">
                <div>
                  <h3 className="font-medium">{c.name}</h3>
                  {c.description && <p className="text-xs text-muted-foreground mt-1">{c.description}</p>}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(c)}><Edit2 className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
                    if (confirm("Delete this category?")) deleteMut.mutate(c.id);
                  }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={() => resetForm()}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editCat ? "Edit Category" : "Add Category"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Electronics" /></div>
            <div><Label>Description</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
            <Button onClick={() => saveMut.mutate()} disabled={!name.trim() || saveMut.isPending}>
              {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              {editCat ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SourcesTab() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editSource, setEditSource] = useState<Source | null>(null);

  const { data: sources, isLoading } = useQuery({
    queryKey: ["product-sources"],
    queryFn: () => apiGet<Source[]>("/product-sources"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiDelete(`/product-sources/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["product-sources"] }); toast.success("Source deleted"); },
  });

  const syncMut = useMutation({
    mutationFn: (id: number) => apiPost<{ imported: number; total: number }>(`/product-sources/${id}/sync`, {}),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["product-sources"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(`Synced ${data.imported} products`);
    },
    onError: (err: any) => toast.error(`Sync failed: ${err.message}`),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Connect external APIs and webhooks to sync your product inventory
          </p>
        </div>
        <Button onClick={() => { setEditSource(null); setShowAdd(true); }} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Source
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !sources?.length ? (
        <Card><CardContent className="py-12 text-center">
          <Plug className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">No API sources connected yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Add an API source or webhook to auto-sync products from your inventory system</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {sources.map((s) => (
            <SourceCard
              key={s.id}
              source={s}
              onEdit={() => { setEditSource(s); setShowAdd(true); }}
              onDelete={() => { if (confirm("Delete this source?")) deleteMut.mutate(s.id); }}
              onSync={() => syncMut.mutate(s.id)}
              syncing={syncMut.isPending}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <SourceDialog
          source={editSource}
          onClose={() => { setShowAdd(false); setEditSource(null); }}
          onSaved={() => { setShowAdd(false); setEditSource(null); qc.invalidateQueries({ queryKey: ["product-sources"] }); }}
        />
      )}
    </div>
  );
}

function SourceCard({
  source,
  onEdit,
  onDelete,
  onSync,
  syncing,
}: {
  source: Source;
  onEdit: () => void;
  onDelete: () => void;
  onSync: () => void;
  syncing: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const baseUrl = getBaseUrl();
  const webhookUrl = source.type === "webhook" && source.webhookSecret
    ? `${window.location.origin}${baseUrl}/product-webhook/${source.webhookSecret}`
    : null;

  const copyWebhookUrl = () => {
    if (webhookUrl) {
      navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Webhook URL copied");
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{source.name}</h3>
              <Badge variant={source.isActive ? "default" : "secondary"} className="text-xs">
                {source.isActive ? <><Wifi className="h-3 w-3 mr-1" /> Active</> : <><WifiOff className="h-3 w-3 mr-1" /> Inactive</>}
              </Badge>
              <Badge variant="outline" className="text-xs capitalize">{source.type}</Badge>
            </div>
            {source.apiUrl && (
              <p className="text-xs text-muted-foreground font-mono truncate">{source.apiUrl}</p>
            )}
            {source.lastSyncAt && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>Last sync: {new Date(source.lastSyncAt).toLocaleString()}</span>
                {source.lastSyncStatus && (
                  <Badge variant={source.lastSyncStatus === "success" ? "default" : "destructive"} className="text-xs">
                    {source.lastSyncStatus}
                  </Badge>
                )}
                {source.lastSyncCount != null && <span>{source.lastSyncCount} products</span>}
              </div>
            )}
            {webhookUrl && (
              <div className="flex items-center gap-2 mt-2">
                <code className="text-xs bg-muted px-2 py-1 rounded font-mono flex-1 truncate">{webhookUrl}</code>
                <Button size="sm" variant="ghost" onClick={copyWebhookUrl}>
                  {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            )}
          </div>
          <div className="flex gap-1.5 shrink-0">
            {source.type === "api" && (
              <Button size="sm" variant="outline" onClick={onSync} disabled={syncing} className="gap-1">
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} /> Sync
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onEdit}><Edit2 className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SourceDialog({
  source,
  onClose,
  onSaved,
}: {
  source: Source | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: source?.name || "",
    type: source?.type || "api" as "api" | "webhook" | "manual",
    apiUrl: source?.apiUrl || "",
    apiKey: source?.apiKey || "",
    headerKey: source?.headerKey || "",
    headerValue: source?.headerValue || "",
    fieldMapping: JSON.stringify(source?.fieldMapping || { id: "id", name: "name", price: "price", description: "description", sku: "sku", imageUrl: "image", stock: "stock" }, null, 2),
    isActive: source?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Source name is required"); return; }
    setSaving(true);
    try {
      let mapping: Record<string, string> | null = null;
      try { mapping = JSON.parse(form.fieldMapping); } catch { mapping = null; }

      const body = {
        name: form.name,
        type: form.type,
        apiUrl: form.apiUrl || null,
        apiKey: form.apiKey && form.apiKey !== "••••••" ? form.apiKey : undefined,
        headerKey: form.headerKey || null,
        headerValue: form.headerValue && form.headerValue !== "••••••" ? form.headerValue : undefined,
        fieldMapping: mapping,
        isActive: form.isActive,
      };

      if (source) {
        await apiPut(`/product-sources/${source.id}`, body);
        toast.success("Source updated");
      } else {
        await apiPost("/product-sources", body);
        toast.success("Source added");
      }
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{source ? "Edit Source" : "Add API Source"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Shopify Inventory" /></div>
          <div>
            <Label>Connection Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as "api" | "webhook" | "manual" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="api">REST API — Pull products from an API endpoint</SelectItem>
                <SelectItem value="webhook">Webhook — Receive product updates via webhook</SelectItem>
                <SelectItem value="manual">Manual — Add products manually</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.type === "api" && (
            <>
              <div>
                <Label>API Endpoint URL</Label>
                <Input value={form.apiUrl} onChange={(e) => setForm({ ...form, apiUrl: e.target.value })} placeholder="https://api.example.com/products" />
                <p className="text-xs text-muted-foreground mt-1">The API should return a JSON array of products or an object with a products/items/data key</p>
              </div>
              <div>
                <Label>API Key (Bearer token)</Label>
                <Input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder="Your API key" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Custom Header Name</Label><Input value={form.headerKey} onChange={(e) => setForm({ ...form, headerKey: e.target.value })} placeholder="X-API-Key" /></div>
                <div><Label>Custom Header Value</Label><Input type="password" value={form.headerValue} onChange={(e) => setForm({ ...form, headerValue: e.target.value })} /></div>
              </div>
            </>
          )}

          {form.type === "webhook" && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-1.5"><ExternalLink className="h-4 w-4" /> Webhook Setup</h4>
              <p className="text-xs text-muted-foreground">
                After saving, you'll get a unique webhook URL. Configure your inventory system to POST product data to this URL.
              </p>
              <p className="text-xs text-muted-foreground">
                Expected payload: <code className="bg-background px-1 rounded">{"{ \"products\": [...], \"event\": \"upsert\" | \"delete\" }"}</code>
              </p>
            </div>
          )}

          <div>
            <Label>Field Mapping (JSON)</Label>
            <Textarea
              value={form.fieldMapping}
              onChange={(e) => setForm({ ...form, fieldMapping: e.target.value })}
              rows={5}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Map your API fields to CRM fields: id, name, price, description, sku, imageUrl, stock, currency
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
            <Label>Active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            {source ? "Update" : "Add Source"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
