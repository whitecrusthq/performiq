import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Search, ChevronRight, X, User, Briefcase, Heart,
  CreditCard, FileText, Edit2, Check, Phone, Mail, MapPin,
  Building2, Hash, Plus, RefreshCw, Trash2, FolderOpen, AlertCircle,
  ShieldAlert, Paperclip, Upload, Eye, ChevronDown, Download, Clock,
} from "lucide-react";
import { apiFetch } from "@/lib/utils";

function csvEscape(val: any): string {
  if (val == null || val === "") return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.map(csvEscape).join(","), ...rows.map(r => r.map(csvEscape).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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

type Tab = "personal" | "employment" | "financial" | "emergency" | "notes" | "documents" | "disciplinary";

const TABS: { id: Tab; label: string; icon: any; adminOnly?: boolean }[] = [
  { id: "personal",     label: "Personal",     icon: User },
  { id: "employment",   label: "Employment",   icon: Briefcase },
  { id: "financial",    label: "Financial",     icon: CreditCard },
  { id: "emergency",    label: "Next of Kin",   icon: Heart },
  { id: "documents",    label: "Documents",     icon: FolderOpen },
  { id: "disciplinary", label: "Disciplinary",  icon: ShieldAlert, adminOnly: true },
  { id: "notes",        label: "Notes",         icon: FileText },
];

const DOC_TYPES: { value: string; label: string; color: string }[] = [
  { value: "contract",         label: "Employment Contract", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  { value: "guarantor",        label: "Guarantor Form",      color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  { value: "id_copy",          label: "ID / Passport Copy",  color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
  { value: "offer_letter",     label: "Offer Letter",        color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  { value: "reference_letter", label: "Reference Letter",    color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
  { value: "certificate",      label: "Certificate / Qualification", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  { value: "nda",              label: "NDA",                 color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  { value: "policy",           label: "Policy Acknowledgement", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  { value: "medical",          label: "Medical Record",      color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400" },
  { value: "other",            label: "Other",               color: "bg-muted text-muted-foreground" },
];

function docTypeInfo(type: string) {
  return DOC_TYPES.find(d => d.value === type) ?? DOC_TYPES[DOC_TYPES.length - 1];
}

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
const SEVERITY_CONFIG: Record<string, { label: string; color: string }> = {
  minor:    { label: "Minor",    color: "bg-yellow-100 text-yellow-700" },
  moderate: { label: "Moderate", color: "bg-orange-100 text-orange-700" },
  major:    { label: "Major",    color: "bg-red-100 text-red-700" },
  critical: { label: "Critical", color: "bg-red-200 text-red-800" },
};

const RECORD_TYPES: { value: string; label: string }[] = [
  { value: "disciplinary", label: "Disciplinary Action" },
  { value: "performance",  label: "Performance Query" },
  { value: "warning",      label: "Warning" },
  { value: "suspension",   label: "Suspension" },
  { value: "misconduct",   label: "Misconduct" },
  { value: "other",        label: "Other" },
];

function StaffPanel({ staffId, canEdit, onClose, onUpdated }: {
  staffId: number; canEdit: boolean; onClose: () => void; onUpdated: (u: any) => void;
}) {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("personal");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<any>({});
  const isAdminUser = currentUser?.role === "admin" || currentUser?.role === "super_admin";

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

  // Documents
  const [addingDoc, setAddingDoc] = useState(false);
  const [docDraft, setDocDraft] = useState({ name: "", documentType: "contract", receivedDate: "", notes: "" });

  const { data: documents = [], refetch: refetchDocs } = useQuery<any[]>({
    queryKey: ["staff-docs", staffId],
    queryFn: () => apiFetchJson(`/api/users/${staffId}/documents`),
    enabled: tab === "documents",
  });

  const addDoc = useMutation({
    mutationFn: (body: any) => apiFetchJson(`/api/users/${staffId}/documents`, {
      method: "POST", body: JSON.stringify(body),
    }),
    onSuccess: () => {
      refetchDocs();
      setAddingDoc(false);
      setDocDraft({ name: "", documentType: "contract", receivedDate: "", notes: "" });
      toast({ title: "Document added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteDoc = useMutation({
    mutationFn: (docId: number) => apiFetchJson(`/api/users/${staffId}/documents/${docId}`, { method: "DELETE" }),
    onSuccess: () => { refetchDocs(); toast({ title: "Document removed" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const [addingRecord, setAddingRecord] = useState(false);
  const [recordDraft, setRecordDraft] = useState({ type: "disciplinary", subject: "", description: "", sanctionApplied: "", severity: "minor", incidentDate: "" });
  const [pendingFiles, setPendingFiles] = useState<{ file: File; name: string }[]>([]);
  const [uploadingRecord, setUploadingRecord] = useState(false);
  const [expandedRecord, setExpandedRecord] = useState<number | null>(null);

  const { data: disciplinaryRecords = [], refetch: refetchDisciplinary } = useQuery<any[]>({
    queryKey: ["staff-disciplinary", staffId],
    queryFn: () => apiFetchJson(`/api/users/${staffId}/disciplinary`),
    enabled: tab === "disciplinary" && isAdminUser,
  });

  const handleAddRecord = async () => {
    if (!recordDraft.subject.trim()) return;
    setUploadingRecord(true);
    try {
      const uploadedAttachments: any[] = [];
      for (const pf of pendingFiles) {
        const urlRes = await apiFetchJson("/api/storage/uploads/request-url", { method: "POST" });
        await fetch(urlRes.uploadURL, {
          method: "PUT",
          headers: { "Content-Type": pf.file.type },
          body: pf.file,
        });
        uploadedAttachments.push({
          fileName: pf.name,
          fileType: pf.file.type,
          objectPath: urlRes.objectPath,
        });
      }
      await apiFetchJson(`/api/users/${staffId}/disciplinary`, {
        method: "POST",
        body: JSON.stringify({ ...recordDraft, attachments: uploadedAttachments }),
      });
      refetchDisciplinary();
      setAddingRecord(false);
      setRecordDraft({ type: "disciplinary", subject: "", description: "", sanctionApplied: "", severity: "minor", incidentDate: "" });
      setPendingFiles([]);
      toast({ title: "Record added" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setUploadingRecord(false);
  };

  const handleAddAttachment = async (recordId: number, file: File) => {
    try {
      const urlRes = await apiFetchJson("/api/storage/uploads/request-url", { method: "POST" });
      await fetch(urlRes.uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      await apiFetchJson(`/api/users/${staffId}/disciplinary/${recordId}/attachments`, {
        method: "POST",
        body: JSON.stringify({ fileName: file.name, fileType: file.type, objectPath: urlRes.objectPath }),
      });
      refetchDisciplinary();
      toast({ title: "File attached" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    }
  };

  const deleteRecord = useMutation({
    mutationFn: (id: number) => apiFetchJson(`/api/users/${staffId}/disciplinary/${id}`, { method: "DELETE" }),
    onSuccess: () => { refetchDisciplinary(); toast({ title: "Record deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteAttachment = useMutation({
    mutationFn: ({ recordId, attachmentId }: { recordId: number; attachmentId: number }) =>
      apiFetchJson(`/api/users/${staffId}/disciplinary/${recordId}/attachments/${attachmentId}`, { method: "DELETE" }),
    onSuccess: () => { refetchDisciplinary(); toast({ title: "Attachment removed" }); },
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
      maritalStatus: staff.maritalStatus ?? "",
      religion: staff.religion ?? "",
      nationalId: staff.nationalId ?? "",
      startDate: staff.startDate ?? "",
      emergencyContactName: staff.emergencyContactName ?? "",
      emergencyContactPhone: staff.emergencyContactPhone ?? "",
      emergencyContactRelation: staff.emergencyContactRelation ?? "",
      emergencyContactAddress: staff.emergencyContactAddress ?? "",
      bankName: staff.bankName ?? "",
      bankBranch: staff.bankBranch ?? "",
      bankAccountNumber: staff.bankAccountNumber ?? "",
      bankAccountName: staff.bankAccountName ?? "",
      taxId: staff.taxId ?? "",
      pensionId: staff.pensionId ?? "",
      hmo: staff.hmo ?? "",
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
              <button onClick={() => {
                if (!staff) return;
                const s = staff;
                const headers = ["Field", "Value"];
                const rows: string[][] = [
                  ["Name", s.name ?? ""], ["Email", s.email ?? ""], ["Phone", s.phone ?? ""],
                  ["Staff ID", s.staffId ?? ""], ["Department", s.department ?? ""], ["Job Title", s.jobTitle ?? ""],
                  ["Role", s.role?.replace("_", " ") ?? ""], ["Site", s.site?.name ?? ""],
                  ["Date of Birth", s.dateOfBirth ?? ""], ["Gender", s.gender ?? ""],
                  ["National ID", s.nationalId ?? ""], ["Start Date", s.startDate ?? ""],
                  ["Marital Status", s.maritalStatus ?? ""], ["Nationality", s.nationality ?? ""],
                  ["Religion", s.religion ?? ""], ["State of Origin", s.stateOfOrigin ?? ""],
                  ["Maiden Name", s.maidenName ?? ""], ["Hobbies", s.hobbies ?? ""],
                  ["Spouse Name", s.spouseName ?? ""], ["Spouse Occupation", s.spouseOccupation ?? ""],
                  ["No. of Children", s.numberOfChildren != null ? String(s.numberOfChildren) : ""],
                  ["Address", s.address ?? ""], ["Permanent Address", s.permanentAddress ?? ""],
                  ["Temporary Address", s.temporaryAddress ?? ""],
                  ["City", s.city ?? ""], ["State/Province", s.stateProvince ?? ""],
                  ["Country", s.country ?? ""], ["Postal Code", s.postalCode ?? ""],
                  ["Bank Name", s.bankName ?? ""], ["Bank Branch", s.bankBranch ?? ""],
                  ["Account Name", s.bankAccountName ?? ""], ["Account Number", s.bankAccountNumber ?? ""],
                  ["Tax ID", s.taxId ?? ""], ["Pension ID", s.pensionId ?? ""],
                  ["PFA Name", s.pfaName ?? ""], ["RSA PIN", s.rsaPin ?? ""], ["HMO", s.hmo ?? ""],
                  ["Emergency Contact", s.emergencyContactName ?? ""],
                  ["Emergency Phone", s.emergencyContactPhone ?? ""],
                  ["Emergency Relation", s.emergencyContactRelation ?? ""],
                  ["Emergency Address", s.emergencyContactAddress ?? ""],
                  ["Probation End Date", s.probationEndDate ?? ""],
                  ["Probation Status", s.probationStatus ?? ""],
                ];
                downloadCsv(`staff-${(s.name ?? "profile").replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
              }} className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground" title="Export Profile">
                <Download className="w-4 h-4" />
              </button>
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
          {TABS.filter(t => !t.adminOnly || isAdminUser).map(t => {
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
                    <SelectField label="Marital Status" value={d.maritalStatus} editing={editing}
                      options={[{ value: "single", label: "Single" }, { value: "married", label: "Married" }, { value: "divorced", label: "Divorced" }, { value: "widowed", label: "Widowed" }, { value: "separated", label: "Separated" }]}
                      onChange={set("maritalStatus")} />
                    <Field label="Religion" value={d.religion} editing={editing} placeholder="e.g. Christianity, Islam" onChange={set("religion")} />
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
                  {staff?.probationEndDate && (
                    <div className="border-t border-border/50 pt-4">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> Probation Period
                      </h4>
                      {(() => {
                        const end = new Date(staff.probationEndDate);
                        const now = new Date();
                        const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86400000);
                        const status = staff.probationStatus ?? "active";
                        const statusConfig: Record<string, { label: string; color: string }> = {
                          active:    { label: "On Probation",  color: "bg-amber-100 text-amber-700" },
                          extended:  { label: "Extended",       color: "bg-orange-100 text-orange-700" },
                          confirmed: { label: "Confirmed",      color: "bg-green-100 text-green-700" },
                          failed:    { label: "Failed",         color: "bg-red-100 text-red-700" },
                        };
                        const sc = statusConfig[status] ?? statusConfig.active;
                        return (
                          <div className="bg-muted/30 rounded-xl p-4 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sc.color}`}>{sc.label}</span>
                              <span className="text-sm text-muted-foreground">
                                Ends: {end.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" })}
                              </span>
                            </div>
                            {(status === "active" || status === "extended") && (
                              <p className={`text-sm font-medium ${daysLeft <= 0 ? "text-red-600" : daysLeft <= 14 ? "text-amber-600" : "text-foreground"}`}>
                                {daysLeft <= 0 ? "Probation period has ended — awaiting confirmation" : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining`}
                              </p>
                            )}
                            {isAdminUser && (status === "active" || status === "extended") && (
                              <div className="flex gap-2 pt-1">
                                <button onClick={async () => {
                                  if (!confirm("Confirm this employee has passed probation?")) return;
                                  await apiFetchJson(`/api/onboarding/probation/${staffId}`, { method: "PUT", body: JSON.stringify({ action: "confirm" }) });
                                  refetch();
                                }} className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors">
                                  Confirm Passed
                                </button>
                                <button onClick={async () => {
                                  const days = prompt("Extend probation by how many days?", "30");
                                  if (!days) return;
                                  await apiFetchJson(`/api/onboarding/probation/${staffId}`, { method: "PUT", body: JSON.stringify({ action: "extend", extendDays: days }) });
                                  refetch();
                                }} className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors">
                                  Extend
                                </button>
                                <button onClick={async () => {
                                  if (!confirm("Mark this employee as having failed probation?")) return;
                                  await apiFetchJson(`/api/onboarding/probation/${staffId}`, { method: "PUT", body: JSON.stringify({ action: "fail" }) });
                                  refetch();
                                }} className="px-3 py-1.5 rounded-lg text-red-600 border border-red-200 text-xs font-medium hover:bg-red-50 transition-colors">
                                  Fail
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
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
                      <h4 className="text-sm font-semibold flex items-center gap-1.5"><Hash className="w-4 h-4" /> Tax & Pension Information</h4>
                      <Field label="Tax ID / TIN" value={d.taxId} editing={editing} placeholder="Tax identification number" onChange={set("taxId")} />
                      <Field label="Pension ID" value={d.pensionId} editing={editing} placeholder="Pension scheme ID" onChange={set("pensionId")} />
                      <Field label="HMO (Health Insurance)" value={d.hmo} editing={editing} placeholder="e.g. AXA / Hygeia plan name or ID" onChange={set("hmo")} />
                    </div>
                  </div>
                </div>
              )}

              {/* Next of Kin Tab */}
              {tab === "emergency" && (
                <div className="space-y-5">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Heart className="w-3.5 h-3.5" /> Next of Kin / Emergency Contact
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    <Field label="Full Name" value={d.emergencyContactName} editing={editing} placeholder="Full name" onChange={set("emergencyContactName")} />
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Phone Number" value={d.emergencyContactPhone} editing={editing} type="tel" placeholder="+1 555 000 0000" onChange={set("emergencyContactPhone")} />
                      <Field label="Relationship" value={d.emergencyContactRelation} editing={editing} placeholder="e.g. Spouse, Parent, Sibling" onChange={set("emergencyContactRelation")} />
                    </div>
                    <Field label="Address" value={d.emergencyContactAddress} editing={editing} placeholder="Contact address" onChange={set("emergencyContactAddress")} />
                  </div>
                </div>
              )}

              {/* Documents Tab */}
              {tab === "documents" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                      <FolderOpen className="w-3.5 h-3.5" /> Received Documents
                    </h3>
                    {canEdit && !addingDoc && (
                      <button onClick={() => setAddingDoc(true)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
                        <Plus className="w-3.5 h-3.5" /> Add Document
                      </button>
                    )}
                  </div>

                  {/* Add Document Form */}
                  {addingDoc && (
                    <div className="border border-primary/30 bg-primary/5 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-semibold text-primary">New Document Record</p>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Document Name *</label>
                          <input
                            value={docDraft.name}
                            onChange={e => setDocDraft(p => ({ ...p, name: e.target.value }))}
                            placeholder="e.g. John's Guarantor Form"
                            className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Document Type</label>
                            <select
                              value={docDraft.documentType}
                              onChange={e => setDocDraft(p => ({ ...p, documentType: e.target.value }))}
                              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20">
                              {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Date Received</label>
                            <input
                              type="date"
                              value={docDraft.receivedDate}
                              onChange={e => setDocDraft(p => ({ ...p, receivedDate: e.target.value }))}
                              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Notes</label>
                          <textarea
                            value={docDraft.notes}
                            onChange={e => setDocDraft(p => ({ ...p, notes: e.target.value }))}
                            placeholder="Any notes about this document…"
                            rows={2}
                            className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => { setAddingDoc(false); setDocDraft({ name: "", documentType: "contract", receivedDate: "", notes: "" }); }}
                            className="px-3 py-1.5 rounded-xl border border-border text-xs font-medium hover:bg-muted transition-colors">
                            Cancel
                          </button>
                          <button
                            onClick={() => addDoc.mutate(docDraft)}
                            disabled={!docDraft.name.trim() || addDoc.isPending}
                            className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            {addDoc.isPending ? "Saving…" : "Save Document"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Document List */}
                  {(documents as any[]).length === 0 && !addingDoc ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No documents recorded yet</p>
                      <p className="text-xs mt-1">Add guarantor forms, contracts, ID copies and more</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(documents as any[]).map((doc: any) => {
                        const info = docTypeInfo(doc.documentType);
                        return (
                          <div key={doc.id} className="border border-border rounded-xl p-3.5 flex items-start gap-3 hover:bg-muted/20 transition-colors">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-sm truncate">{doc.name}</p>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${info.color}`}>{info.label}</span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                                {doc.receivedDate && (
                                  <span>Received: {new Date(doc.receivedDate).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" })}</span>
                                )}
                                {doc.uploadedByName && <span>Logged by: {doc.uploadedByName}</span>}
                              </div>
                              {doc.notes && <p className="text-xs text-muted-foreground mt-1 italic">{doc.notes}</p>}
                            </div>
                            {canEdit && (
                              <button
                                onClick={() => { if (confirm("Remove this document record?")) deleteDoc.mutate(doc.id); }}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground italic">
                    This is a record of documents received — attach physical files or scans in your file management system.
                  </p>
                </div>
              )}

              {/* Disciplinary Tab */}
              {tab === "disciplinary" && isAdminUser && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                      <ShieldAlert className="w-3.5 h-3.5" /> Disciplinary & Performance Records
                    </h3>
                    {!addingRecord && (
                      <button onClick={() => setAddingRecord(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                        <Plus className="w-3.5 h-3.5" /> Add Record
                      </button>
                    )}
                  </div>

                  {addingRecord && (
                    <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/20">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase">Type</label>
                          <select value={recordDraft.type} onChange={e => setRecordDraft(p => ({ ...p, type: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm">
                            {RECORD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase">Severity</label>
                          <select value={recordDraft.severity} onChange={e => setRecordDraft(p => ({ ...p, severity: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm">
                            {Object.entries(SEVERITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase">Subject *</label>
                        <input value={recordDraft.subject} onChange={e => setRecordDraft(p => ({ ...p, subject: e.target.value }))}
                          placeholder="Brief summary of the issue" className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase">Description</label>
                        <textarea value={recordDraft.description} onChange={e => setRecordDraft(p => ({ ...p, description: e.target.value }))}
                          placeholder="Full details of the incident or query..." rows={3}
                          className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm resize-none" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase">Sanction Applied</label>
                          <input value={recordDraft.sanctionApplied} onChange={e => setRecordDraft(p => ({ ...p, sanctionApplied: e.target.value }))}
                            placeholder="e.g. Written warning, Suspension..."
                            className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase">Incident Date</label>
                          <input type="date" value={recordDraft.incidentDate} onChange={e => setRecordDraft(p => ({ ...p, incidentDate: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase">Attachments</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {pendingFiles.map((pf, i) => (
                            <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted text-xs">
                              <Paperclip className="w-3 h-3" /> {pf.name}
                              <button onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 cursor-pointer transition-colors">
                          <Upload className="w-3.5 h-3.5" /> Choose Files
                          <input type="file" multiple className="hidden" onChange={e => {
                            const files = Array.from(e.target.files || []);
                            setPendingFiles(prev => [...prev, ...files.map(f => ({ file: f, name: f.name }))]);
                            e.target.value = "";
                          }} />
                        </label>
                        <p className="text-xs text-muted-foreground mt-1">Screenshots, documents, evidence files</p>
                      </div>

                      <div className="flex gap-2 justify-end pt-1">
                        <button onClick={() => { setAddingRecord(false); setPendingFiles([]); setRecordDraft({ type: "disciplinary", subject: "", description: "", sanctionApplied: "", severity: "minor", incidentDate: "" }); }}
                          className="px-3 py-1.5 rounded-xl border border-border text-xs font-medium hover:bg-muted transition-colors">
                          Cancel
                        </button>
                        <button onClick={handleAddRecord}
                          disabled={!recordDraft.subject.trim() || uploadingRecord}
                          className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          {uploadingRecord ? "Saving…" : "Save Record"}
                        </button>
                      </div>
                    </div>
                  )}

                  {(disciplinaryRecords as any[]).length === 0 && !addingRecord ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No disciplinary records</p>
                      <p className="text-xs mt-1">Add disciplinary actions, performance queries, and sanctions</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(disciplinaryRecords as any[]).map((rec: any) => {
                        const sevCfg = SEVERITY_CONFIG[rec.severity] ?? SEVERITY_CONFIG.minor;
                        const typeCfg = RECORD_TYPES.find(t => t.value === rec.type);
                        const isExpanded = expandedRecord === rec.id;
                        return (
                          <div key={rec.id} className="border border-border rounded-xl overflow-hidden">
                            <button onClick={() => setExpandedRecord(isExpanded ? null : rec.id)}
                              className="w-full flex items-start gap-3 p-4 text-left hover:bg-muted/20 transition-colors">
                              <ShieldAlert className={`w-4 h-4 mt-0.5 shrink-0 ${rec.severity === "critical" || rec.severity === "major" ? "text-red-500" : "text-amber-500"}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-semibold text-sm">{rec.subject}</p>
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sevCfg.color}`}>{sevCfg.label}</span>
                                  {typeCfg && <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{typeCfg.label}</span>}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                                  {rec.incidentDate && <span>Incident: {new Date(rec.incidentDate).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" })}</span>}
                                  {rec.createdByName && <span>By: {rec.createdByName}</span>}
                                  <span>Added: {new Date(rec.createdAt).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" })}</span>
                                  {rec.attachments?.length > 0 && <span className="flex items-center gap-1"><Paperclip className="w-3 h-3" /> {rec.attachments.length} file(s)</span>}
                                </div>
                              </div>
                              <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                            </button>

                            {isExpanded && (
                              <div className="border-t border-border p-4 space-y-3 bg-muted/10">
                                {rec.description && (
                                  <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Description</p>
                                    <p className="text-sm whitespace-pre-wrap">{rec.description}</p>
                                  </div>
                                )}
                                {rec.sanctionApplied && (
                                  <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Sanction Applied</p>
                                    <p className="text-sm font-medium text-red-600">{rec.sanctionApplied}</p>
                                  </div>
                                )}

                                {rec.attachments?.length > 0 && (
                                  <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Attachments</p>
                                    <div className="space-y-1.5">
                                      {rec.attachments.map((att: any) => (
                                        <div key={att.id} className="flex items-center gap-2 text-xs bg-background border border-border rounded-lg px-3 py-2">
                                          <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                          <span className="flex-1 truncate">{att.fileName}</span>
                                          <a href={`/api/storage/objects/${att.objectPath.split("/").pop()}`} target="_blank" rel="noopener noreferrer"
                                            className="text-primary hover:underline flex items-center gap-1 shrink-0">
                                            <Eye className="w-3.5 h-3.5" /> View
                                          </a>
                                          <button onClick={() => deleteAttachment.mutate({ recordId: rec.id, attachmentId: att.id })}
                                            className="text-muted-foreground hover:text-destructive shrink-0">
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="flex items-center gap-2 pt-1">
                                  <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 cursor-pointer transition-colors">
                                    <Upload className="w-3 h-3" /> Add File
                                    <input type="file" className="hidden" onChange={e => {
                                      const f = e.target.files?.[0];
                                      if (f) handleAddAttachment(rec.id, f);
                                      e.target.value = "";
                                    }} />
                                  </label>
                                  <div className="flex-1" />
                                  <button onClick={() => { if (confirm("Delete this disciplinary record and all attachments?")) deleteRecord.mutate(rec.id); }}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-destructive hover:bg-destructive/10 transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" /> Delete Record
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground italic">
                    Disciplinary records are confidential and visible to HR administrators only.
                  </p>
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

  const exportStaffList = () => {
    const headers = ["Staff ID", "Name", "Email", "Phone", "Department", "Job Title", "Role", "Site", "Start Date", "Date of Birth", "Gender", "Address", "City", "State/Province", "Country", "National ID", "Bank Name", "Bank Account Name", "Emergency Contact", "Emergency Phone"];
    const rows = filtered.map((u: any) => [
      u.staffId ?? "", u.name ?? "", u.email ?? "", u.phone ?? "",
      u.department ?? "", u.jobTitle ?? "", u.role?.replace("_", " ") ?? "",
      u.site?.name ?? u.siteName ?? "", u.startDate ?? "", u.dateOfBirth ?? "",
      u.gender ?? "", u.address ?? "", u.city ?? "", u.stateProvince ?? "",
      u.country ?? "", u.nationalId ?? "", u.bankName ?? "", u.bankAccountName ?? "",
      u.emergencyContactName ?? "", u.emergencyContactPhone ?? "",
    ]);
    downloadCsv(`staff-list-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff Profiles</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage employee details, banking, tax, and emergency contacts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={exportStaffList}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
            <Download className="w-4 h-4" /> Export List
          </button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>{(users as any[]).length} staff members</span>
          </div>
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
