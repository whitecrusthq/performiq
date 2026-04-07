import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { getChannelIcon, getChannelColor } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Search, Download, Filter, Mail, Phone, MessageSquare, Loader2,
  UserPlus, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle,
  ChevronDown, X, Users, FileDown,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Link } from "wouter";
import { apiGet, apiPost } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface ApiCustomer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  channel: "whatsapp" | "facebook" | "instagram";
  tags: string[];
  notes: string | null;
  totalConversations: number;
  lastSeen: string | null;
}
interface CustomersResponse { total: number; customers: ApiCustomer[]; }

// ── CSV helpers ──────────────────────────────────────────────────────────────

function customersToCSV(rows: ApiCustomer[]): string {
  const headers = ["Name", "Email", "Phone", "Channel", "Tags", "Total Conversations", "Last Seen"];
  const lines = [
    headers.join(","),
    ...rows.map((c) => [
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.email ?? ""}"`,
      `"${c.phone ?? ""}"`,
      c.channel,
      `"${(c.tags ?? []).join(";")}"`,
      c.totalConversations,
      c.lastSeen ? new Date(c.lastSeen).toLocaleDateString("en-GB") : "",
    ].join(",")),
  ];
  return lines.join("\n");
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadTemplate() {
  const template = "Name,Email,Phone,Channel,Tags,Notes\nJohn Doe,john@example.com,+1234567890,whatsapp,VIP;premium,Important customer\nJane Smith,jane@example.com,+0987654321,facebook,new,";
  downloadCSV(template, "customers_import_template.csv");
}

// ── Parse uploaded file (CSV or Excel) ──────────────────────────────────────

interface ParsedRow { name: string; email: string; phone: string; channel: string; tags: string; notes: string; _valid: boolean; _error?: string; }

function parseFile(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        const rows: ParsedRow[] = json.map((r) => {
          // Normalize column names (case-insensitive)
          const get = (...keys: string[]) => {
            for (const k of keys) {
              const found = Object.keys(r).find((rk) => rk.toLowerCase() === k.toLowerCase());
              if (found) return String(r[found] ?? "").trim();
            }
            return "";
          };

          const name = get("name", "full name", "customer name", "customer");
          const email = get("email", "email address");
          const phone = get("phone", "phone number", "mobile", "tel");
          const channel = get("channel", "platform", "source");
          const tags = get("tags", "tag", "labels");
          const notes = get("notes", "note", "comments", "description");

          const validChannels = ["whatsapp", "facebook", "instagram"];
          const normalizedChannel = channel.toLowerCase();
          const _valid = !!name;
          const _error = !name ? "Name is required" : undefined;

          return {
            name,
            email,
            phone,
            channel: validChannels.includes(normalizedChannel) ? normalizedChannel : "whatsapp",
            tags,
            notes,
            _valid,
            _error,
          };
        });

        resolve(rows.filter((r) => r.name || r.email || r.phone)); // skip completely empty rows
      } catch (err) {
        reject(new Error("Failed to parse file. Please use the provided template."));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Customers() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [selectedCustomer, setSelectedCustomer] = useState<ApiCustomer | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Single add form state
  const [singleName, setSingleName] = useState("");
  const [singleEmail, setSingleEmail] = useState("");
  const [singlePhone, setSinglePhone] = useState("");
  const [singleChannel, setSingleChannel] = useState("whatsapp");
  const [singleTags, setSingleTags] = useState("");
  const [singleNotes, setSingleNotes] = useState("");
  const [singleSaving, setSingleSaving] = useState(false);

  // Bulk import state
  const fileRef = useRef<HTMLInputElement>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importRows, setImportRows] = useState<ParsedRow[]>([]);
  const [importParsing, setImportParsing] = useState(false);
  const [importSaving, setImportSaving] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; errors: Array<{ row: number; error: string }> } | null>(null);

  const params = new URLSearchParams({ limit: "100" });
  if (searchQuery) params.set("search", searchQuery);
  if (channelFilter !== "all") params.set("channel", channelFilter);

  const { data, isLoading } = useQuery<CustomersResponse>({
    queryKey: ["customers", searchQuery, channelFilter],
    queryFn: () => apiGet(`/customers?${params.toString()}`),
    staleTime: 10000,
  });

  const customers = data?.customers ?? [];
  const allIds = customers.map((c) => c.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Export ─────────────────────────────────────────────────────────────────

  const handleExportSelected = () => {
    const rows = customers.filter((c) => selectedIds.has(c.id));
    if (rows.length === 0) { toast({ title: "No customers selected", variant: "destructive" }); return; }
    downloadCSV(customersToCSV(rows), `customers_selected_${new Date().toISOString().slice(0, 10)}.csv`);
    setShowExportMenu(false);
    toast({ title: `Exported ${rows.length} customer${rows.length !== 1 ? "s" : ""}` });
  };

  const handleExportAll = async () => {
    setExportingAll(true);
    setShowExportMenu(false);
    try {
      const exportParams = new URLSearchParams();
      if (channelFilter !== "all") exportParams.set("channel", channelFilter);
      const res = await apiGet<{ customers: ApiCustomer[] }>(`/customers/export?${exportParams.toString()}`);
      downloadCSV(customersToCSV(res.customers), `customers_all_${new Date().toISOString().slice(0, 10)}.csv`);
      toast({ title: `Exported ${res.customers.length} customers` });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    } finally {
      setExportingAll(false);
    }
  };

  // ── Single Add ─────────────────────────────────────────────────────────────

  const handleAddSingle = async () => {
    if (!singleName.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    setSingleSaving(true);
    try {
      await apiPost("/customers", {
        name: singleName.trim(),
        email: singleEmail.trim() || null,
        phone: singlePhone.trim() || null,
        channel: singleChannel,
        tags: singleTags.split(",").map((t) => t.trim()).filter(Boolean),
        notes: singleNotes.trim() || null,
      });
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: `${singleName} added successfully` });
      setSingleName(""); setSingleEmail(""); setSinglePhone(""); setSingleChannel("whatsapp"); setSingleTags(""); setSingleNotes("");
      setAddDialogOpen(false);
    } catch {
      toast({ title: "Failed to add customer", variant: "destructive" });
    } finally {
      setSingleSaving(false);
    }
  };

  // ── Bulk Import ────────────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportResult(null);
    setImportParsing(true);
    try {
      const rows = await parseFile(file);
      setImportRows(rows);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to parse file", variant: "destructive" });
      setImportRows([]);
    } finally {
      setImportParsing(false);
    }
  };

  const handleBulkImport = async () => {
    const validRows = importRows.filter((r) => r._valid);
    if (validRows.length === 0) { toast({ title: "No valid rows to import", variant: "destructive" }); return; }
    setImportSaving(true);
    try {
      const res = await apiPost<{ created: number; errors: Array<{ row: number; error: string }> }>("/customers/bulk", {
        customers: validRows.map((r) => ({
          name: r.name,
          email: r.email || null,
          phone: r.phone || null,
          channel: r.channel,
          tags: r.tags ? r.tags.split(/[;,]/).map((t) => t.trim()).filter(Boolean) : [],
          notes: r.notes || null,
        })),
      });
      setImportResult(res);
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: `Imported ${res.created} customer${res.created !== 1 ? "s" : ""}${res.errors.length > 0 ? ` (${res.errors.length} error${res.errors.length !== 1 ? "s" : ""})` : ""}` });
      if (res.errors.length === 0) {
        setImportFile(null); setImportRows([]);
        if (fileRef.current) fileRef.current.value = "";
      }
    } catch {
      toast({ title: "Import failed", variant: "destructive" });
    } finally {
      setImportSaving(false);
    }
  };

  const resetImport = () => {
    setImportFile(null); setImportRows([]); setImportResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="h-full flex flex-col">
      {/* Page Header */}
      <div className="px-8 pt-6 pb-4 shrink-0 bg-background border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Manage your contacts across all channels.
              {data && <span className="ml-1 font-medium">{data.total.toLocaleString()} total.</span>}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            {/* Export button + dropdown */}
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setShowExportMenu((v) => !v)}
                disabled={exportingAll}
              >
                {exportingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Export CSV
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-lg border bg-popover shadow-lg py-1 text-sm">
                  <button
                    className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 disabled:opacity-50"
                    onClick={handleExportSelected}
                    disabled={!someSelected}
                  >
                    <FileDown className="h-4 w-4" />
                    Export Selected
                    {someSelected && <Badge variant="secondary" className="ml-auto text-xs">{selectedIds.size}</Badge>}
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2"
                    onClick={handleExportAll}
                  >
                    <Users className="h-4 w-4" />
                    Export All Customers
                  </button>
                </div>
              )}
            </div>

            {/* Add Customer button */}
            <Button size="sm" className="gap-2" onClick={() => { setAddDialogOpen(true); setShowExportMenu(false); }}>
              <UserPlus className="h-4 w-4" /> Add Customer
            </Button>
          </div>
        </div>
      </div>

      {/* Contacts List */}
      <div className="flex-1 overflow-hidden" onClick={() => setShowExportMenu(false)}>
        <div className="p-6 h-full flex flex-col gap-4">
          <Card className="flex-1 flex flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="relative w-72">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search name, email, phone…"
                    className="pl-9 bg-background"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-customers"
                  />
                </div>
                {/* Channel filter pills */}
                <div className="flex gap-1.5">
                  {(["all", "whatsapp", "facebook", "instagram"] as const).map((ch) => (
                    <button
                      key={ch}
                      onClick={() => setChannelFilter(ch)}
                      className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${channelFilter === ch ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                    >
                      {ch === "all" ? "All" : ch.charAt(0).toUpperCase() + ch.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {someSelected && (
                  <span className="text-xs text-muted-foreground">
                    {selectedIds.size} selected
                  </span>
                )}
                <Badge variant="secondary" className="text-xs">{data?.total ?? 0} contacts</Badge>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-10 pl-4">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Interactions</TableHead>
                    <TableHead>Last Seen</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : customers.map((customer) => {
                    const Icon = getChannelIcon(customer.channel);
                    const isSelected = selectedIds.has(customer.id);
                    return (
                      <TableRow
                        key={customer.id}
                        className={`cursor-pointer hover:bg-muted/30 ${isSelected ? "bg-primary/5" : ""}`}
                        data-testid={`customer-row-${customer.id}`}
                      >
                        <TableCell className="pl-4" onClick={(e) => { e.stopPropagation(); toggleSelect(customer.id); }}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(customer.id)}
                            aria-label={`Select ${customer.name}`}
                          />
                        </TableCell>
                        <TableCell onClick={() => setSelectedCustomer(customer)}>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback>{customer.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{customer.name}</span>
                          </div>
                        </TableCell>
                        <TableCell onClick={() => setSelectedCustomer(customer)}>
                          <div className="text-sm">
                            <div>{customer.phone ?? "—"}</div>
                            <div className="text-muted-foreground text-xs">{customer.email ?? "—"}</div>
                          </div>
                        </TableCell>
                        <TableCell onClick={() => setSelectedCustomer(customer)}>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Icon className={`h-4 w-4 ${getChannelColor(customer.channel)}`} />
                            <span className="capitalize">{customer.channel}</span>
                          </div>
                        </TableCell>
                        <TableCell onClick={() => setSelectedCustomer(customer)}>
                          <div className="flex flex-wrap gap-1">
                            {(customer.tags ?? []).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs bg-muted">{tag}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell onClick={() => setSelectedCustomer(customer)}>
                          <div className="text-sm font-medium">{customer.totalConversations}</div>
                        </TableCell>
                        <TableCell onClick={() => setSelectedCustomer(customer)}>
                          <div className="text-sm text-muted-foreground">
                            {customer.lastSeen ? formatDistanceToNow(new Date(customer.lastSeen), { addSuffix: true }) : "—"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedCustomer(customer)}>
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!isLoading && customers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        No customers found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>

      {/* ── Add Customer Dialog ───────────────────────────────────────────────── */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Add Customer
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="single">
            <TabsList className="w-full">
              <TabsTrigger value="single" className="flex-1 gap-2">
                <UserPlus className="h-4 w-4" /> Single Customer
              </TabsTrigger>
              <TabsTrigger value="bulk" className="flex-1 gap-2">
                <FileSpreadsheet className="h-4 w-4" /> Bulk Import (Excel / CSV)
              </TabsTrigger>
            </TabsList>

            {/* ── Single Tab ─────────────────────────────────── */}
            <TabsContent value="single" className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <Label>Full Name <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="e.g. Daniel Adeyemi"
                    value={singleName}
                    onChange={(e) => setSingleName(e.target.value)}
                    data-testid="input-add-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="customer@example.com"
                    value={singleEmail}
                    onChange={(e) => setSingleEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input
                    placeholder="+1 234 567 8900"
                    value={singlePhone}
                    onChange={(e) => setSinglePhone(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Channel <span className="text-destructive">*</span></Label>
                  <Select value={singleChannel} onValueChange={setSingleChannel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Tags <span className="text-xs text-muted-foreground">(comma separated)</span></Label>
                  <Input
                    placeholder="VIP, premium, new"
                    value={singleTags}
                    onChange={(e) => setSingleTags(e.target.value)}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Notes</Label>
                  <Input
                    placeholder="Any additional notes…"
                    value={singleNotes}
                    onChange={(e) => setSingleNotes(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddSingle} disabled={singleSaving} className="gap-2">
                  {singleSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Add Customer
                </Button>
              </DialogFooter>
            </TabsContent>

            {/* ── Bulk Import Tab ─────────────────────────────── */}
            <TabsContent value="bulk" className="space-y-4 pt-2">
              {/* Instructions */}
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/40 p-4 text-sm text-blue-700 dark:text-blue-300">
                <p className="font-medium mb-1">How to import</p>
                <ol className="list-decimal list-inside space-y-0.5 text-xs">
                  <li>Download the template below to get the correct column format</li>
                  <li>Fill in your customer data (Name is required; Channel defaults to WhatsApp if blank)</li>
                  <li>Upload your CSV or Excel (.xlsx) file</li>
                  <li>Review the preview, then click Import</li>
                </ol>
              </div>

              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" className="gap-2" onClick={downloadTemplate}>
                  <Download className="h-4 w-4" /> Download Template
                </Button>
                <span className="text-xs text-muted-foreground">CSV format with example rows</span>
              </div>

              <Separator />

              {/* File upload zone */}
              {!importFile ? (
                <div
                  className="rounded-lg border-2 border-dashed border-border p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="font-medium text-sm">Click to upload or drag & drop</p>
                  <p className="text-xs text-muted-foreground mt-1">Supports CSV and Excel (.xlsx, .xls) — max 1,000 rows</p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={handleFileChange}
                    data-testid="input-import-file"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {/* File info */}
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                    <FileSpreadsheet className="h-5 w-5 text-green-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{importFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {importParsing ? "Parsing…" : `${importRows.length} rows detected · ${importRows.filter((r) => r._valid).length} valid`}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={resetImport}><X className="h-4 w-4" /></Button>
                  </div>

                  {/* Import result */}
                  {importResult && (
                    <div className={`rounded-lg border p-3 flex items-start gap-2.5 text-sm ${importResult.errors.length === 0 ? "bg-green-50 dark:bg-green-900/10 border-green-200 text-green-700 dark:text-green-300" : "bg-orange-50 dark:bg-orange-900/10 border-orange-200 text-orange-700 dark:text-orange-300"}`}>
                      {importResult.errors.length === 0
                        ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                        : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
                      <div>
                        <p className="font-medium">{importResult.created} customer{importResult.created !== 1 ? "s" : ""} imported successfully</p>
                        {importResult.errors.length > 0 && (
                          <p className="text-xs mt-0.5">{importResult.errors.length} row{importResult.errors.length !== 1 ? "s" : ""} skipped: {importResult.errors.slice(0, 3).map((e) => `Row ${e.row}`).join(", ")}{importResult.errors.length > 3 ? "…" : ""}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Preview table */}
                  {importParsing ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : importRows.length > 0 && (
                    <div className="rounded-lg border overflow-hidden">
                      <div className="bg-muted/50 px-3 py-2 text-xs font-medium flex items-center justify-between">
                        <span>Preview (first 10 rows)</span>
                        <span className="text-muted-foreground">{importRows.filter((r) => r._valid).length} valid / {importRows.filter((r) => !r._valid).length} invalid</span>
                      </div>
                      <div className="overflow-x-auto max-h-52">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/30 sticky top-0">
                            <tr>
                              <th className="text-left px-3 py-2">#</th>
                              <th className="text-left px-3 py-2">Name</th>
                              <th className="text-left px-3 py-2">Email</th>
                              <th className="text-left px-3 py-2">Phone</th>
                              <th className="text-left px-3 py-2">Channel</th>
                              <th className="text-left px-3 py-2">Tags</th>
                              <th className="text-left px-3 py-2">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importRows.slice(0, 10).map((row, i) => (
                              <tr key={i} className={`${i % 2 === 0 ? "bg-background" : "bg-muted/10"} ${!row._valid ? "opacity-60" : ""}`}>
                                <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                                <td className="px-3 py-1.5 font-medium">{row.name || <span className="text-destructive">—</span>}</td>
                                <td className="px-3 py-1.5 text-muted-foreground">{row.email || "—"}</td>
                                <td className="px-3 py-1.5 text-muted-foreground">{row.phone || "—"}</td>
                                <td className="px-3 py-1.5 capitalize">{row.channel}</td>
                                <td className="px-3 py-1.5 text-muted-foreground">{row.tags || "—"}</td>
                                <td className="px-3 py-1.5">
                                  {row._valid
                                    ? <span className="text-green-600 font-medium">✓ Valid</span>
                                    : <span className="text-destructive">{row._error}</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {importRows.length > 10 && (
                          <div className="px-3 py-2 bg-muted/20 text-xs text-muted-foreground border-t">
                            +{importRows.length - 10} more rows not shown in preview
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Close</Button>
                {importFile && !importResult && (
                  <Button
                    onClick={handleBulkImport}
                    disabled={importSaving || importParsing || importRows.filter((r) => r._valid).length === 0}
                    className="gap-2"
                    data-testid="button-import-confirm"
                  >
                    {importSaving
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</>
                      : <><Upload className="h-4 w-4" /> Import {importRows.filter((r) => r._valid).length} Customers</>}
                  </Button>
                )}
                {importResult && (
                  <Button onClick={resetImport} variant="outline" className="gap-2">
                    <Upload className="h-4 w-4" /> Import Another File
                  </Button>
                )}
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* ── Customer Detail Sheet ─────────────────────────────────────────────── */}
      <Sheet open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          {selectedCustomer && (
            <div className="mt-6 space-y-6">
              <div className="flex flex-col items-center text-center space-y-3 pb-6 border-b">
                <Avatar className="h-24 w-24 border-4 border-background shadow-sm">
                  <AvatarFallback className="text-2xl">{selectedCustomer.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-2xl font-bold">{selectedCustomer.name}</h2>
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-1">
                    {(() => { const Icon = getChannelIcon(selectedCustomer.channel); return <Icon className={`h-4 w-4 ${getChannelColor(selectedCustomer.channel)}`} />; })()}
                    Preferred: <span className="capitalize text-foreground">{selectedCustomer.channel}</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <Link href="/inbox">
                    <Button className="gap-2" data-testid="button-message-customer">
                      <MessageSquare className="h-4 w-4" /> Message
                    </Button>
                  </Link>
                  <Button variant="outline" className="gap-2">Edit Profile</Button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Contact Info</h3>
                <div className="space-y-3 bg-muted/30 p-4 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{selectedCustomer.phone ?? "Not provided"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{selectedCustomer.email ?? "Not provided"}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {(selectedCustomer.tags ?? []).map((tag) => (
                    <Badge key={tag} variant="secondary" className="px-3 py-1 bg-primary/10 text-primary">{tag}</Badge>
                  ))}
                  <Button variant="outline" size="sm" className="h-6 rounded-full text-xs">+ Add Tag</Button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Notes</h3>
                <div className="bg-muted/30 p-4 rounded-lg border text-sm">
                  {selectedCustomer.notes ? <p>{selectedCustomer.notes}</p> : <p className="text-muted-foreground italic">No notes added yet.</p>}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Interaction Summary</h3>
                <div className="bg-muted/30 p-4 rounded-lg border text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total conversations</span>
                    <span className="font-medium">{selectedCustomer.totalConversations}</span>
                  </div>
                  {selectedCustomer.lastSeen && (
                    <div className="flex justify-between mt-2">
                      <span className="text-muted-foreground">Last seen</span>
                      <span className="font-medium">{formatDistanceToNow(new Date(selectedCustomer.lastSeen), { addSuffix: true })}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
