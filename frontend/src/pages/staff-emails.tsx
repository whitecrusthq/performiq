import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Mail, Send, Users, Search, History, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { PageHeader, Card, Button, Input, Label } from "@/components/shared";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/utils";

async function apiFetchJson(url: string, opts: RequestInit = {}) {
  const r = await apiFetch(url, opts);
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? "Request failed"); }
  return r.json();
}

interface Options {
  emailProvider: string | null;
  departments: string[];
  jobTitles: string[];
  genders: string[];
  probationStatuses: string[];
  shiftTypes: string[];
  roles: string[];
  sites: { id: number; name: string; category: string | null }[];
  siteCategories: string[];
  grades: { id: number; name: string }[];
  customRoles: { id: number; name: string }[];
}

interface Recipient {
  id: number;
  name: string;
  email: string;
  department: string | null;
  jobTitle: string | null;
  role: string;
  siteName: string | null;
}

interface Campaign {
  id: number;
  subject: string;
  body: string;
  filters: Record<string, any>;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  failures: { email: string; error: string }[];
  status: string;
  sentByName: string | null;
  createdAt: string;
  completedAt: string | null;
}

type Filters = {
  departments: string[];
  siteIds: string[];
  siteCategories: string[];
  roles: string[];
  customRoleIds: string[];
  gradeIds: string[];
  jobTitles: string[];
  genders: string[];
  probationStatuses: string[];
  shiftTypes: string[];
};

const EMPTY_FILTERS: Filters = {
  departments: [], siteIds: [], siteCategories: [], roles: [], customRoleIds: [],
  gradeIds: [], jobTitles: [], genders: [], probationStatuses: [], shiftTypes: [],
};

const pretty = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

const FILTER_LABELS: Record<keyof Filters, string> = {
  departments: "Department",
  siteIds: "Site",
  siteCategories: "Site category",
  roles: "Role",
  customRoleIds: "Custom role",
  gradeIds: "Grade",
  jobTitles: "Job title",
  genders: "Gender",
  probationStatuses: "Probation status",
  shiftTypes: "Shift type",
};

function MultiSelect({ label, options, value, onChange }: {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  if (options.length === 0) return null;
  const shown = options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()));
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);
  const summary = value.length === 0
    ? `All`
    : value.length === 1 ? options.find(o => o.value === value[0])?.label ?? "1 selected" : `${value.length} selected`;

  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button"
            className={`mt-1 w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-sm bg-background text-left ${value.length ? "border-primary/50 text-foreground" : "border-border text-muted-foreground"}`}>
            <span className="truncate">{summary}</span>
            <ChevronDown className="w-4 h-4 shrink-0 opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-2">
          {options.length > 8 && (
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search…"
              className="w-full mb-2 px-2 py-1.5 rounded-lg border border-border bg-background text-sm outline-none" />
          )}
          <div className="max-h-64 overflow-y-auto space-y-0.5">
            {shown.map(o => (
              <label key={o.value} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted cursor-pointer text-sm">
                <input type="checkbox" checked={value.includes(o.value)} onChange={() => toggle(o.value)}
                  className="w-4 h-4 rounded border-border accent-primary" />
                <span className="truncate">{o.label}</span>
              </label>
            ))}
            {shown.length === 0 && <p className="text-xs text-muted-foreground px-2 py-1.5">No matches</p>}
          </div>
          {value.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground underline">
              Clear
            </button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function StatusPill({ c }: { c: Campaign }) {
  if (c.status === "sending") {
    return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700"><Loader2 className="w-3 h-3 animate-spin" /> Sending</span>;
  }
  if (c.status === "completed") {
    return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3" /> Sent</span>;
  }
  const label = c.status === "failed" ? "Failed" : "Sent with errors";
  return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><AlertCircle className="w-3 h-3" /> {label}</span>;
}

export default function StaffEmails() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"compose" | "history">("compose");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: options } = useQuery<Options>({
    queryKey: ["staff-email-options"],
    queryFn: () => apiFetchJson("/api/staff-emails/options"),
  });

  const apiFilters = useMemo(() => ({
    departments: filters.departments,
    siteIds: filters.siteIds.map(Number),
    siteCategories: filters.siteCategories,
    roles: filters.roles,
    customRoleIds: filters.customRoleIds.map(Number),
    gradeIds: filters.gradeIds.map(Number),
    jobTitles: filters.jobTitles,
    genders: filters.genders,
    probationStatuses: filters.probationStatuses,
    shiftTypes: filters.shiftTypes,
  }), [filters]);

  const { data: preview, isFetching: previewLoading, error: previewError } = useQuery<{ count: number; recipients: Recipient[] }>({
    queryKey: ["staff-email-preview", apiFilters],
    queryFn: () => apiFetchJson("/api/staff-emails/preview", { method: "POST", body: JSON.stringify({ filters: apiFilters }) }),
  });

  const { data: history = [] } = useQuery<Campaign[]>({
    queryKey: ["staff-email-history"],
    queryFn: () => apiFetchJson("/api/staff-emails/history"),
    refetchInterval: q => (Array.isArray(q.state.data) && q.state.data.some((c: Campaign) => c.status === "sending") ? 3000 : false),
  });

  // A new audience starts fully ticked.
  useEffect(() => { setExcluded(new Set()); }, [apiFilters]);

  const recipients = preview?.recipients ?? [];
  const selectedCount = recipients.filter(r => !excluded.has(r.id)).length;
  const shownRecipients = recipients.filter(r => {
    const q = search.toLowerCase();
    return !q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q);
  });
  const activeFilterCount = Object.values(filters).filter(v => v.length > 0).length;

  const setFilter = (key: keyof Filters) => (v: string[]) => setFilters(f => ({ ...f, [key]: v }));

  const sendMutation = useMutation({
    mutationFn: () => apiFetchJson("/api/staff-emails/send", {
      method: "POST",
      body: JSON.stringify({
        filters: apiFilters,
        userIds: excluded.size > 0 ? recipients.filter(r => !excluded.has(r.id)).map(r => r.id) : undefined,
        subject,
        body,
      }),
    }),
    onSuccess: (c: Campaign) => {
      toast({ title: "Email is being sent", description: `Sending to ${c.recipientCount} staff member${c.recipientCount === 1 ? "" : "s"}. Track progress under Sent history.` });
      setSubject("");
      setBody("");
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["staff-email-history"] });
      setTab("history");
    },
    onError: (e: any) => {
      setConfirmOpen(false);
      toast({ title: "Could not send email", description: e?.message || "Please try again.", variant: "destructive" });
    },
  });

  const canSend = subject.trim() && body.trim() && selectedCount > 0;

  const audienceSummary = (f: Record<string, any>) => {
    if (!options) return "";
    const parts: string[] = [];
    const name = (list: { id: number; name: string }[], id: number) => list.find(x => x.id === id)?.name ?? `#${id}`;
    for (const key of Object.keys(FILTER_LABELS) as (keyof Filters)[]) {
      const v = f[key];
      if (!Array.isArray(v) || v.length === 0) continue;
      const labels = key === "siteIds" ? v.map((id: number) => name(options.sites, id))
        : key === "gradeIds" ? v.map((id: number) => name(options.grades, id))
        : key === "customRoleIds" ? v.map((id: number) => name(options.customRoles, id))
        : key === "roles" ? v.map(pretty) : v;
      parts.push(`${FILTER_LABELS[key]}: ${labels.join(", ")}`);
    }
    const base = parts.length ? parts.join(" · ") : "All staff";
    return f.selectedOnly ? `${base} (hand-picked)` : base;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Staff Emails" description="Send an email to all staff or to groups picked by department, site, role, grade and more." />

      <div className="flex gap-1 border-b border-border">
        {([["compose", "Compose", Mail], ["history", "Sent history", History]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "compose" ? (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3 space-y-6">
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">1. Choose recipients</h3>
                {activeFilterCount > 0 && (
                  <button onClick={() => setFilters(EMPTY_FILTERS)} className="text-xs text-muted-foreground hover:text-foreground underline">
                    Clear all filters
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Leave every filter on "All" to email all active staff. Within a filter, any ticked value matches; across filters, staff must match all of them.
              </p>
              {options ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <MultiSelect label="Department" value={filters.departments} onChange={setFilter("departments")}
                    options={options.departments.map(d => ({ value: d, label: d }))} />
                  <MultiSelect label="Site" value={filters.siteIds} onChange={setFilter("siteIds")}
                    options={options.sites.map(s => ({ value: String(s.id), label: s.name }))} />
                  <MultiSelect label="Site category" value={filters.siteCategories} onChange={setFilter("siteCategories")}
                    options={options.siteCategories.map(c => ({ value: c, label: c }))} />
                  <MultiSelect label="Role" value={filters.roles} onChange={setFilter("roles")}
                    options={options.roles.map(r => ({ value: r, label: pretty(r) }))} />
                  <MultiSelect label="Custom role" value={filters.customRoleIds} onChange={setFilter("customRoleIds")}
                    options={options.customRoles.map(r => ({ value: String(r.id), label: r.name }))} />
                  <MultiSelect label="Grade" value={filters.gradeIds} onChange={setFilter("gradeIds")}
                    options={options.grades.map(g => ({ value: String(g.id), label: g.name }))} />
                  <MultiSelect label="Job title" value={filters.jobTitles} onChange={setFilter("jobTitles")}
                    options={options.jobTitles.map(j => ({ value: j, label: j }))} />
                  <MultiSelect label="Gender" value={filters.genders} onChange={setFilter("genders")}
                    options={options.genders.map(g => ({ value: g, label: pretty(g) }))} />
                  <MultiSelect label="Probation status" value={filters.probationStatuses} onChange={setFilter("probationStatuses")}
                    options={options.probationStatuses.map(p => ({ value: p, label: pretty(p) }))} />
                  <MultiSelect label="Shift type" value={filters.shiftTypes} onChange={setFilter("shiftTypes")}
                    options={options.shiftTypes.map(s => ({ value: s, label: pretty(s) }))} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Loading filters…</p>
              )}
            </Card>

            <Card className="p-5 space-y-4">
              <h3 className="font-semibold">2. Write the email</h3>
              {options && (options.emailProvider ? (
                <p className="text-xs text-muted-foreground">
                  Sending through <span className="font-medium text-foreground">{options.emailProvider}</span>.
                  {options.emailProvider === "Gmail" && " Gmail allows about 500 recipients a day (2,000 on Google Workspace)."}
                </p>
              ) : (
                <p className="text-xs rounded-lg border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2">
                  No email service is set up yet. An admin needs to enable Mailgun, Gmail or SMTP under Settings → Notifications before emails can be sent.
                </p>
              ))}
              <div>
                <Label>Subject</Label>
                <Input value={subject} onChange={e => setSubject(e.target.value)} maxLength={200} placeholder="e.g. Office closure on Friday" className="mt-1" />
              </div>
              <div>
                <Label>Message</Label>
                <textarea value={body} onChange={e => setBody(e.target.value)} rows={10} maxLength={20000}
                  placeholder={"Dear {{firstName}},\n\n…"}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                <p className="text-xs text-muted-foreground mt-1">
                  Personalise with <code>{"{{firstName}}"}</code>, <code>{"{{name}}"}</code>, <code>{"{{department}}"}</code>, <code>{"{{jobTitle}}"}</code> or <code>{"{{staffId}}"}</code>. Each person gets their own copy and can't see other recipients.
                </p>
              </div>
              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="text-sm text-muted-foreground">
                  {selectedCount} recipient{selectedCount === 1 ? "" : "s"} selected
                </p>
                <Button onClick={() => setConfirmOpen(true)} disabled={!canSend}>
                  <Send className="w-4 h-4 mr-2" /> Send email
                </Button>
              </div>
            </Card>
          </div>

          <Card className="lg:col-span-2 p-5 flex flex-col max-h-[calc(100vh-12rem)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2"><Users className="w-4 h-4" /> Recipients</h3>
              <span className="text-sm text-muted-foreground">
                {previewLoading ? "Updating…" : `${selectedCount} of ${recipients.length}`}
              </span>
            </div>
            {recipients.length > 0 && (
              <>
                <div className="relative mb-2">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search recipients…"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-background text-sm outline-none" />
                </div>
                <div className="flex gap-3 mb-2 text-xs">
                  <button onClick={() => setExcluded(new Set())} className="text-primary hover:underline">Select all</button>
                  <button onClick={() => setExcluded(new Set(recipients.map(r => r.id)))} className="text-muted-foreground hover:underline">Select none</button>
                </div>
              </>
            )}
            <div className="flex-1 overflow-y-auto -mx-2 divide-y divide-border">
              {previewError ? (
                <p className="text-sm text-destructive px-2 py-6 text-center">{(previewError as Error).message}</p>
              ) : recipients.length === 0 && !previewLoading ? (
                <p className="text-sm text-muted-foreground px-2 py-6 text-center">No active staff match these filters.</p>
              ) : shownRecipients.map(r => (
                <label key={r.id} className="flex items-start gap-3 px-2 py-2 hover:bg-muted/40 cursor-pointer">
                  <input type="checkbox" checked={!excluded.has(r.id)}
                    onChange={() => setExcluded(prev => { const n = new Set(prev); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; })}
                    className="mt-1 w-4 h-4 rounded border-border accent-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                    <p className="text-xs text-muted-foreground/80 truncate">
                      {[r.department, r.jobTitle, r.siteName].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </Card>
        </div>
      ) : (
        <Card className="p-0 overflow-hidden">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No staff emails sent yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {history.map(c => (
                <div key={c.id} className="px-5 py-4">
                  <button className="w-full text-left" onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{c.subject}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(c.createdAt).toLocaleString()} · {c.sentByName ?? "Unknown sender"} · {audienceSummary(c.filters)}
                        </p>
                      </div>
                      <div className="text-right shrink-0 space-y-1">
                        <StatusPill c={c} />
                        <p className="text-xs text-muted-foreground">
                          {c.sentCount}/{c.recipientCount} delivered{c.failedCount ? ` · ${c.failedCount} failed` : ""}
                        </p>
                      </div>
                    </div>
                  </button>
                  {expandedId === c.id && (
                    <div className="mt-3 space-y-3">
                      <pre className="whitespace-pre-wrap text-sm bg-muted/40 rounded-xl p-3 font-sans">{c.body}</pre>
                      {c.failures.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-destructive mb-1">Failed recipients</p>
                          <ul className="text-xs text-muted-foreground space-y-0.5">
                            {c.failures.map((f, i) => <li key={i}><span className="font-medium">{f.email}</span>: {f.error}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={o => !sendMutation.isPending && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send to {selectedCount} staff member{selectedCount === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              "{subject}" will be emailed to {activeFilterCount === 0 && excluded.size === 0 ? "all active staff" : "the selected recipients"}. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sendMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={e => { e.preventDefault(); sendMutation.mutate(); }}
              disabled={sendMutation.isPending}>
              {sendMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</> : "Send now"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
