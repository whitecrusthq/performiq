import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Search, ChevronRight, X, User, Briefcase, Heart,
  CreditCard, FileText, Edit2, Check, Phone, Mail, MapPin,
  Calendar, Shield, Building2, Hash, Plus, RefreshCw,
} from "lucide-react";
import { apiFetch } from "@/lib/utils";

async function apiFetchJson(url: string, opts: RequestInit = {}) {
  const r = await apiFetch(url, opts);
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? "Request failed"); }
  return r.json();
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-violet-100 text-violet-700",
  admin:       "bg-purple-100 text-purple-700",
  manager:     "bg-blue-100 text-blue-700",
  employee:    "bg-slate-100 text-slate-700",
};

function Avatar({ name, photo, size = 40 }: { name: string; photo?: string | null; size?: number }) {
  if (photo) return <img src={photo} alt={name} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-sm"
      style={{ width: size, height: size, fontSize: size * 0.35 }}>
      {initials}
    </div>
  );
}

type Tab = "personal" | "employment" | "financial" | "emergency" | "notes";

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "personal",   label: "Personal",   icon: User },
  { id: "employment", label: "Employment", icon: Briefcase },
  { id: "financial",  label: "Financial",  icon: CreditCard },
  { id: "emergency",  label: "Emergency",  icon: Heart },
  { id: "notes",      label: "Notes",      icon: FileText },
];

function Field({ label, value, editing, type = "text", placeholder, onChange }: {
  label: string; value?: string | null; editing: boolean;
  type?: string; placeholder?: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">{label}</label>
      {editing ? (
        <input
          type={type}
          value={value ?? ""}
          placeholder={placeholder ?? label}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20"
        />
      ) : (
        <p className={`text-sm py-1.5 ${value ? "text-foreground" : "text-muted-foreground/60 italic"}`}>
          {value || "Not set"}
        </p>
      )}
    </div>
  );
}

function SelectField({ label, value, editing, options, onChange }: {
  label: string; value?: string | null; editing: boolean;
  options: { value: string; label: string }[]; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">{label}</label>
      {editing ? (
        <select
          value={value ?? ""}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">— Select —</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <p className={`text-sm py-1.5 ${value ? "text-foreground" : "text-muted-foreground/60 italic"}`}>
          {options.find(o => o.value === value)?.label ?? value ?? "Not set"}
        </p>
      )}
    </div>
  );
}

function TextareaField({ label, value, editing, placeholder, onChange }: {
  label: string; value?: string | null; editing: boolean; placeholder?: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">{label}</label>
      {editing ? (
        <textarea
          value={value ?? ""}
          placeholder={placeholder ?? label}
          onChange={e => onChange(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
        />
      ) : (
        <p className={`text-sm py-1.5 whitespace-pre-wrap ${value ? "text-foreground" : "text-muted-foreground/60 italic"}`}>
          {value || "Not set"}
        </p>
      )}
    </div>
  );
}

// ── Staff Detail Panel ─────────────────────────────────────────────────────────
function StaffPanel({ staffId, canEdit, onClose, onUpdated }: {
  staffId: number; canEdit: boolean; onClose: () => void; onUpdated: (u: any) => void;
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("personal");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<any>({});

  const { data: staff, isLoading, refetch } = useQuery({
    queryKey: ["staff-detail", staffId],
    queryFn: () => apiFetchJson(`/api/users/${staffId}`),
  });

  const save = useMutation({
    mutationFn: (patch: any) => apiFetchJson(`/api/users/${staffId}/hr-profile`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
    onSuccess: (updated) => {
      onUpdated(updated);
      refetch();
      setEditing(false);
      toast({ title: "Profile updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const startEdit = () => {
    if (!staff) return;
    setDraft({
      address: staff.address ?? "",
      city: staff.city ?? "",
      stateProvince: staff.stateProvince ?? "",
      country: staff.country ?? "",
      postalCode: staff.postalCode ?? "",
      dateOfBirth: staff.dateOfBirth ?? "",
      gender: staff.gender ?? "",
      nationalId: staff.nationalId ?? "",
      startDate: staff.startDate ?? "",
      emergencyContactName: staff.emergencyContactName ?? "",
      emergencyContactPhone: staff.emergencyContactPhone ?? "",
      emergencyContactRelation: staff.emergencyContactRelation ?? "",
      bankName: staff.bankName ?? "",
      bankBranch: staff.bankBranch ?? "",
      bankAccountNumber: staff.bankAccountNumber ?? "",
      bankAccountName: staff.bankAccountName ?? "",
      taxId: staff.taxId ?? "",
      notes: staff.notes ?? "",
    });
    setEditing(true);
  };

  const cancelEdit = () => { setDraft({}); setEditing(false); };

  const set = (field: string) => (v: string) => setDraft((p: any) => ({ ...p, [field]: v }));

  const d = editing ? draft : (staff ?? {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/30 backdrop-blur-sm">
      <div className="bg-background h-full w-full max-w-xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 border-b border-border px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {staff && <Avatar name={staff.name} photo={staff.profilePhoto} size={52} />}
              <div>
                <h2 className="text-xl font-bold">{staff?.name ?? "—"}</h2>
                <p className="text-sm text-muted-foreground">{staff?.jobTitle ?? staff?.role ?? "—"}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {staff?.role && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${ROLE_COLORS[staff.role] ?? "bg-muted text-muted-foreground"}`}>
                      {staff.role.replace("_", " ")}
                    </span>
                  )}
                  {staff?.department && (
                    <span className="text-xs text-muted-foreground">{staff.department}</span>
                  )}
                  {staff?.staffId && (
                    <span className="text-xs font-mono text-muted-foreground">#{staff.staffId}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => refetch()} className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground">
                <RefreshCw className="w-4 h-4" />
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/60">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
            {staff?.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{staff.email}</span>}
            {staff?.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{staff.phone}</span>}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border overflow-x-auto shrink-0">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors
                  ${tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Loading…</div>
          ) : (
            <>
              {/* Edit / Save controls */}
              {canEdit && (
                <div className="flex items-center justify-between mb-5">
                  <p className="text-xs text-muted-foreground">
                    {editing ? "Editing — make changes and save" : "Click Edit to update this section"}
                  </p>
                  <div className="flex gap-2">
                    {editing ? (
                      <>
                        <button onClick={cancelEdit}
                          className="px-3 py-1.5 rounded-xl border border-border text-xs font-medium hover:bg-muted transition-colors">
                          Cancel
                        </button>
                        <button onClick={() => save.mutate(draft)} disabled={save.isPending}
                          className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          {save.isPending ? "Saving…" : "Save Changes"}
                        </button>
                      </>
                    ) : (
                      <button onClick={startEdit}
                        className="px-3 py-1.5 rounded-xl border border-border text-xs font-medium hover:bg-muted transition-colors flex items-center gap-1">
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Personal Tab */}
              {tab === "personal" && (
                <div className="space-y-5">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <User className="w-3.5 h-3.5" /> Personal Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Date of Birth" value={d.dateOfBirth} editing={editing} type="date" onChange={set("dateOfBirth")} />
                    <SelectField label="Gender" value={d.gender} editing={editing}
                      options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" }, { value: "prefer_not_to_say", label: "Prefer not to say" }]}
                      onChange={set("gender")} />
                    <Field label="National ID / Passport" value={d.nationalId} editing={editing} placeholder="e.g. A1234567" onChange={set("nationalId")} />
                    <Field label="Start Date" value={d.startDate} editing={editing} type="date" onChange={set("startDate")} />
                  </div>
                  <div className="border-t border-border/50 pt-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> Address
                    </h4>
                    <div className="space-y-3">
                      <Field label="Street Address" value={d.address} editing={editing} placeholder="123 Main Street" onChange={set("address")} />
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="City" value={d.city} editing={editing} onChange={set("city")} />
                        <Field label="State / Province" value={d.stateProvince} editing={editing} onChange={set("stateProvince")} />
                        <Field label="Country" value={d.country} editing={editing} onChange={set("country")} />
                        <Field label="Postal Code" value={d.postalCode} editing={editing} onChange={set("postalCode")} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Employment Tab */}
              {tab === "employment" && (
                <div className="space-y-5">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Briefcase className="w-3.5 h-3.5" /> Employment Details
                  </h3>
                  <div className="bg-muted/30 rounded-xl p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Department</p>
                        <p className="font-medium">{staff?.department ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Job Title</p>
                        <p className="font-medium">{staff?.jobTitle ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Staff ID</p>
                        <p className="font-mono text-xs font-medium">{staff?.staffId ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Role / Access</p>
                        <p className="font-medium capitalize">{staff?.role?.replace("_", " ") ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Member Since</p>
                        <p className="font-medium">
                          {staff?.createdAt ? new Date(staff.createdAt).toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" }) : "—"}
                        </p>
                      </div>
                      {staff?.site && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Site</p>
                          <p className="font-medium">{staff.site.name}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground italic">
                    To update name, email, department, job title or access level — use the User Management page.
                  </p>
                </div>
              )}

              {/* Financial Tab */}
              {tab === "financial" && (
                <div className="space-y-5">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <CreditCard className="w-3.5 h-3.5" /> Banking & Tax Information
                  </h3>
                  <div className="space-y-4">
                    <div className="border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-4 py-3">
                      <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                        🔒 Financial data is sensitive. Only HR admins and the employee themselves can view and update this section.
                      </p>
                    </div>
                    <div className="border border-border rounded-xl p-4 space-y-3">
                      <h4 className="text-sm font-semibold flex items-center gap-1.5"><Building2 className="w-4 h-4" /> Bank Details</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Bank Name" value={d.bankName} editing={editing} placeholder="e.g. Barclays" onChange={set("bankName")} />
                        <Field label="Branch" value={d.bankBranch} editing={editing} placeholder="e.g. City Centre" onChange={set("bankBranch")} />
                        <Field label="Account Name" value={d.bankAccountName} editing={editing} placeholder="Account holder name" onChange={set("bankAccountName")} />
                        <Field label="Account Number" value={d.bankAccountNumber} editing={editing} placeholder="e.g. 00000000" onChange={set("bankAccountNumber")} />
                      </div>
                    </div>
                    <div className="border border-border rounded-xl p-4 space-y-3">
                      <h4 className="text-sm font-semibold flex items-center gap-1.5"><Hash className="w-4 h-4" /> Tax Information</h4>
                      <Field label="Tax ID / TIN" value={d.taxId} editing={editing} placeholder="Tax identification number" onChange={set("taxId")} />
                    </div>
                  </div>
                </div>
              )}

              {/* Emergency Tab */}
              {tab === "emergency" && (
                <div className="space-y-5">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Heart className="w-3.5 h-3.5" /> Emergency Contact
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    <Field label="Contact Name" value={d.emergencyContactName} editing={editing} placeholder="Full name" onChange={set("emergencyContactName")} />
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Phone Number" value={d.emergencyContactPhone} editing={editing} type="tel" placeholder="+1 555 000 0000" onChange={set("emergencyContactPhone")} />
                      <Field label="Relationship" value={d.emergencyContactRelation} editing={editing} placeholder="e.g. Spouse, Parent" onChange={set("emergencyContactRelation")} />
                    </div>
                  </div>
                </div>
              )}

              {/* Notes Tab */}
              {tab === "notes" && (
                <div className="space-y-5">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" /> HR Notes
                  </h3>
                  <TextareaField label="Internal Notes" value={d.notes} editing={editing} placeholder="Any internal HR notes about this employee…" onChange={set("notes")} />
                  <p className="text-xs text-muted-foreground italic">These notes are visible to HR admins only.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Staff Page ────────────────────────────────────────────────────────────
export default function Staff() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const p = new URLSearchParams(window.location.search);
    const id = p.get("id");
    return id ? Number(id) : null;
  });

  const canEdit = user?.role === "admin" || user?.role === "super_admin" || user?.role === "manager";

  const { data: users = [], isLoading } = useQuery<any[]>({
    queryKey: ["staff-list"],
    queryFn: () => apiFetchJson("/api/users"),
  });

  const departments = useMemo(() => [...new Set((users as any[]).map(u => u.department).filter(Boolean))].sort(), [users]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (users as any[]).filter(u => {
      const matchQ = !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.staffId?.toLowerCase().includes(q);
      const matchDept = !filterDept || u.department === filterDept;
      const matchRole = !filterRole || u.role === filterRole;
      return matchQ && matchDept && matchRole;
    });
  }, [users, search, filterDept, filterRole]);

  const handleUpdated = useCallback((updated: any) => {
    qc.setQueryData(["staff-list"], (old: any[]) =>
      (old ?? []).map(u => u.id === updated.id ? updated : u)
    );
    qc.setQueryData(["staff-detail", updated.id], updated);
  }, [qc]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff Profiles</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage employee details, banking, tax, and emergency contacts
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="w-4 h-4" />
          <span>{(users as any[]).length} staff members</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, staff ID…"
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
          className="px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none">
          <option value="">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          className="px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none">
          <option value="">All Roles</option>
          <option value="employee">Employee</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
          <option value="super_admin">Super Admin</option>
        </select>
        {(search || filterDept || filterRole) && (
          <button onClick={() => { setSearch(""); setFilterDept(""); setFilterRole(""); }}
            className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground underline">
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Employee</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Department / Role</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Contact</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Staff ID</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Profile</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">No staff match your search</td></tr>
            ) : filtered.map((u: any) => {
              const hasProfile = !!(u.address || u.bankName || u.taxId || u.emergencyContactName || u.dateOfBirth);
              return (
                <tr key={u.id}
                  onClick={() => setSelectedId(u.id)}
                  className="hover:bg-muted/30 cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} photo={u.profilePhoto} size={36} />
                      <div>
                        <p className="font-semibold leading-tight">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <p className="text-sm">{u.department ?? <span className="text-muted-foreground/60 italic">No dept</span>}</p>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full capitalize ${ROLE_COLORS[u.role] ?? "bg-muted text-muted-foreground"}`}>
                      {u.role?.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                    {u.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" />{u.phone}</div>}
                    {u.jobTitle && <div className="mt-0.5">{u.jobTitle}</div>}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="font-mono text-xs text-muted-foreground">{u.staffId ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {hasProfile ? (
                      <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">Complete</span>
                    ) : (
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Incomplete</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail panel */}
      {selectedId !== null && (
        <StaffPanel
          staffId={selectedId}
          canEdit={canEdit || selectedId === user?.id}
          onClose={() => setSelectedId(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
