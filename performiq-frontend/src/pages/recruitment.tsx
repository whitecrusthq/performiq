import { useState, useEffect } from "react";
import { PageHeader, Card, Button, Input, Label } from "@/components/shared";
import {
  Briefcase, Plus, X, ChevronDown, Users, Search, Filter,
  CheckCircle2, Clock, XCircle, UserPlus, ArrowRight, Star,
  Calendar, MapPin, Building2, Eye, Trash2, Edit2, Send,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/utils";

interface Site { id: number; name: string }
interface UserOption { id: number; name: string; department?: string | null }

interface Job {
  id: number;
  title: string;
  department: string | null;
  siteId: number | null;
  description: string | null;
  requirements: string | null;
  employmentType: string;
  status: string;
  openings: number;
  hiringManagerId: number | null;
  hiringManagerName: string | null;
  createdById: number;
  createdByName: string | null;
  closingDate: string | null;
  site: Site | null;
  candidateCount: number;
  stageCounts: Record<string, number>;
  createdAt: string;
}

interface Candidate {
  id: number;
  jobId: number;
  firstName: string;
  surname: string;
  email: string;
  phone: string | null;
  resumeText: string | null;
  coverLetter: string | null;
  stage: string;
  rating: number | null;
  notes: string | null;
  interviewDate: string | null;
  interviewNotes: string | null;
  offerSalary: string | null;
  offerNotes: string | null;
  rejectionReason: string | null;
  hiredUserId: number | null;
  createdAt: string;
}

const STAGES = ["applied", "screening", "interview", "offer", "hired", "rejected"] as const;

const STAGE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  applied:   { label: "Applied",   color: "bg-blue-100 text-blue-700",   icon: <Send className="w-3.5 h-3.5" /> },
  screening: { label: "Screening", color: "bg-purple-100 text-purple-700", icon: <Search className="w-3.5 h-3.5" /> },
  interview: { label: "Interview", color: "bg-amber-100 text-amber-700", icon: <Users className="w-3.5 h-3.5" /> },
  offer:     { label: "Offer",     color: "bg-green-100 text-green-700", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  hired:     { label: "Hired",     color: "bg-emerald-100 text-emerald-700", icon: <UserPlus className="w-3.5 h-3.5" /> },
  rejected:  { label: "Rejected",  color: "bg-red-100 text-red-700",     icon: <XCircle className="w-3.5 h-3.5" /> },
};

const JOB_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:   { label: "Draft",   color: "bg-gray-100 text-gray-600" },
  open:    { label: "Open",    color: "bg-green-100 text-green-700" },
  on_hold: { label: "On Hold", color: "bg-amber-100 text-amber-700" },
  closed:  { label: "Closed",  color: "bg-red-100 text-red-700" },
  filled:  { label: "Filled",  color: "bg-blue-100 text-blue-700" },
};

const EMP_TYPES: Record<string, string> = {
  full_time: "Full-time", part_time: "Part-time", contract: "Contract", intern: "Intern", temporary: "Temporary",
};

function fmt(d: string) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function StageBadge({ stage }: { stage: string }) {
  const cfg = STAGE_CONFIG[stage] ?? STAGE_CONFIG.applied;
  return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>{cfg.icon}{cfg.label}</span>;
}

function StarRating({ value, onChange }: { value: number | null; onChange?: (v: number) => void }) {
  const rating = value ?? 0;
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} type="button" onClick={() => onChange?.(i)} className="focus:outline-none">
          <Star className={`w-4 h-4 ${i <= rating ? "text-amber-500 fill-amber-500" : "text-gray-300"}`} />
        </button>
      ))}
    </div>
  );
}

export default function Recruitment() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [jobs, setJobs] = useState<Job[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);

  const [jobDialog, setJobDialog] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [jobForm, setJobForm] = useState({ title: "", department: "", siteId: "", description: "", requirements: "", employmentType: "full_time", openings: "1", hiringManagerId: "", closingDate: "", status: "draft" });

  const [candidateDialog, setCandidateDialog] = useState(false);
  const [candidateForm, setCandidateForm] = useState({ firstName: "", surname: "", email: "", phone: "", resumeText: "", coverLetter: "", notes: "" });

  const [hireDialog, setHireDialog] = useState<Candidate | null>(null);
  const [hireForm, setHireForm] = useState({ startDate: "", probationDays: "90", startOnboarding: true });

  const [stageFilter, setStageFilter] = useState<string>("all");
  const [jobStatusFilter, setJobStatusFilter] = useState<string>("all");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [candidateDetail, setCandidateDetail] = useState<Candidate | null>(null);
  const [editingCandidate, setEditingCandidate] = useState(false);
  const [candidateEditForm, setCandidateEditForm] = useState<Partial<Candidate>>({});

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [jr, sr, ur] = await Promise.all([
        apiFetch("/api/recruitment/jobs"),
        apiFetch("/api/sites"),
        apiFetch("/api/users"),
      ]);
      if (jr.ok) setJobs(await jr.json());
      if (sr.ok) setSites(await sr.json());
      if (ur.ok) { const d = await ur.json(); setAllUsers(Array.isArray(d) ? d : d.users || []); }
    } catch {}
    setIsLoading(false);
  }

  async function loadCandidates(jobId: number) {
    setCandidatesLoading(true);
    try {
      const r = await apiFetch(`/api/recruitment/jobs/${jobId}/candidates`);
      if (r.ok) setCandidates(await r.json());
    } catch {}
    setCandidatesLoading(false);
  }

  function openJobDialog(job?: Job) {
    setError(null);
    if (job) {
      setEditingJob(job);
      setJobForm({
        title: job.title, department: job.department || "", siteId: job.siteId?.toString() || "",
        description: job.description || "", requirements: job.requirements || "",
        employmentType: job.employmentType, openings: job.openings.toString(),
        hiringManagerId: job.hiringManagerId?.toString() || "", closingDate: job.closingDate || "",
        status: job.status,
      });
    } else {
      setEditingJob(null);
      setJobForm({ title: "", department: "", siteId: "", description: "", requirements: "", employmentType: "full_time", openings: "1", hiringManagerId: "", closingDate: "", status: "draft" });
    }
    setJobDialog(true);
  }

  async function handleJobSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!jobForm.title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const url = editingJob ? `/api/recruitment/jobs/${editingJob.id}` : "/api/recruitment/jobs";
      const method = editingJob ? "PUT" : "POST";
      const r = await apiFetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(jobForm) });
      const data = await r.json();
      if (!r.ok) { setError(data.error || "Failed"); setSubmitting(false); return; }
      setJobDialog(false);
      load();
    } catch { setError("Network error"); }
    setSubmitting(false);
  }

  async function deleteJob(id: number) {
    if (!confirm("Delete this job requisition and all its candidates?")) return;
    await apiFetch(`/api/recruitment/jobs/${id}`, { method: "DELETE" });
    if (selectedJob?.id === id) { setSelectedJob(null); setCandidates([]); }
    load();
  }

  async function handleCandidateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedJob || !candidateForm.firstName.trim() || !candidateForm.surname.trim() || !candidateForm.email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await apiFetch(`/api/recruitment/jobs/${selectedJob.id}/candidates`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(candidateForm),
      });
      if (!r.ok) { const d = await r.json(); setError(d.error || "Failed"); setSubmitting(false); return; }
      setCandidateDialog(false);
      setCandidateForm({ firstName: "", surname: "", email: "", phone: "", resumeText: "", coverLetter: "", notes: "" });
      loadCandidates(selectedJob.id);
      load();
    } catch { setError("Network error"); }
    setSubmitting(false);
  }

  async function updateCandidateStage(candidateId: number, stage: string) {
    await apiFetch(`/api/recruitment/candidates/${candidateId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage }),
    });
    if (selectedJob) loadCandidates(selectedJob.id);
    load();
  }

  async function updateCandidateDetails() {
    if (!candidateDetail) return;
    setSubmitting(true);
    await apiFetch(`/api/recruitment/candidates/${candidateDetail.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(candidateEditForm),
    });
    if (selectedJob) loadCandidates(selectedJob.id);
    setEditingCandidate(false);
    setCandidateDetail({ ...candidateDetail, ...candidateEditForm } as Candidate);
    setSubmitting(false);
    load();
  }

  async function deleteCandidate(id: number) {
    if (!confirm("Remove this candidate?")) return;
    await apiFetch(`/api/recruitment/candidates/${id}`, { method: "DELETE" });
    setCandidateDetail(null);
    if (selectedJob) loadCandidates(selectedJob.id);
    load();
  }

  async function handleHire() {
    if (!hireDialog) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await apiFetch(`/api/recruitment/candidates/${hireDialog.id}/hire`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hireForm),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || "Failed to hire"); setSubmitting(false); return; }
      setHireDialog(null);
      setCandidateDetail(null);
      if (selectedJob) loadCandidates(selectedJob.id);
      load();
    } catch { setError("Network error"); }
    setSubmitting(false);
  }

  const filteredJobs = jobs.filter(j => jobStatusFilter === "all" || j.status === jobStatusFilter);
  const filteredCandidates = stageFilter === "all" ? candidates : candidates.filter(c => c.stage === stageFilter);
  const departments = [...new Set(jobs.map(j => j.department).filter(Boolean))] as string[];

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div>
      <PageHeader title="Recruitment" description="Manage job requisitions, track candidates, and hire into the onboarding workflow.">
        {isAdmin && (
          <Button onClick={() => openJobDialog()}>
            <Plus className="w-4 h-4 mr-2" /> New Job Requisition
          </Button>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 text-center">
          <Briefcase className="w-6 h-6 text-blue-600 mx-auto mb-1" />
          <p className="text-2xl font-bold">{jobs.filter(j => j.status === "open").length}</p>
          <p className="text-xs text-muted-foreground">Open Positions</p>
        </Card>
        <Card className="p-4 text-center">
          <Users className="w-6 h-6 text-purple-600 mx-auto mb-1" />
          <p className="text-2xl font-bold">{jobs.reduce((s, j) => s + j.candidateCount, 0)}</p>
          <p className="text-xs text-muted-foreground">Total Candidates</p>
        </Card>
        <Card className="p-4 text-center">
          <Clock className="w-6 h-6 text-amber-600 mx-auto mb-1" />
          <p className="text-2xl font-bold">{jobs.reduce((s, j) => s + (j.stageCounts?.interview || 0), 0)}</p>
          <p className="text-xs text-muted-foreground">In Interview</p>
        </Card>
        <Card className="p-4 text-center">
          <UserPlus className="w-6 h-6 text-green-600 mx-auto mb-1" />
          <p className="text-2xl font-bold">{jobs.reduce((s, j) => s + (j.stageCounts?.hired || 0), 0)}</p>
          <p className="text-xs text-muted-foreground">Hired</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: JOBS LIST */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm">Job Requisitions</h3>
            <select value={jobStatusFilter} onChange={e => setJobStatusFilter(e.target.value)} className="border rounded-lg px-2 py-1 text-xs bg-background">
              <option value="all">All Status</option>
              {Object.entries(JOB_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          {filteredJobs.length === 0 ? (
            <Card className="p-6 text-center">
              <Briefcase className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No job requisitions found</p>
            </Card>
          ) : (
            filteredJobs.map(j => (
              <Card
                key={j.id}
                className={`p-4 cursor-pointer transition-all hover:shadow-md ${selectedJob?.id === j.id ? "ring-2 ring-primary" : ""}`}
                onClick={() => { setSelectedJob(j); loadCandidates(j.id); setCandidateDetail(null); setStageFilter("all"); }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{j.title}</p>
                    <p className="text-xs text-muted-foreground">{j.department ?? "—"}{j.site ? ` · ${j.site.name}` : ""}</p>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${JOB_STATUS_CONFIG[j.status]?.color ?? "bg-gray-100 text-gray-600"}`}>
                    {JOB_STATUS_CONFIG[j.status]?.label ?? j.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{EMP_TYPES[j.employmentType] ?? j.employmentType} · {j.openings} opening{j.openings > 1 ? "s" : ""}</span>
                  <span>{j.candidateCount} candidate{j.candidateCount !== 1 ? "s" : ""}</span>
                </div>
                {j.candidateCount > 0 && (
                  <div className="flex gap-1 mt-2">
                    {STAGES.filter(s => s !== "rejected").map(s => {
                      const count = j.stageCounts?.[s] || 0;
                      if (count === 0) return null;
                      return <span key={s} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STAGE_CONFIG[s].color}`}>{STAGE_CONFIG[s].label} {count}</span>;
                    })}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>

        {/* RIGHT: CANDIDATE PIPELINE OR DETAIL */}
        <div className="lg:col-span-2">
          {!selectedJob ? (
            <Card className="p-12 text-center">
              <Briefcase className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Select a job requisition to view its candidate pipeline</p>
            </Card>
          ) : candidateDetail ? (
            /* CANDIDATE DETAIL */
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <button onClick={() => { setCandidateDetail(null); setEditingCandidate(false); }} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                  <ArrowRight className="w-3.5 h-3.5 rotate-180" /> Back to Pipeline
                </button>
                <div className="flex gap-2">
                  {isAdmin && candidateDetail.stage !== "hired" && candidateDetail.stage !== "rejected" && (
                    <Button size="sm" variant="outline" onClick={() => { setEditingCandidate(!editingCandidate); setCandidateEditForm(candidateDetail); }}>
                      <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                    </Button>
                  )}
                  {isAdmin && <Button size="sm" variant="destructive" onClick={() => deleteCandidate(candidateDetail.id)}><Trash2 className="w-3.5 h-3.5 mr-1" /> Remove</Button>}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xl">
                  {candidateDetail.firstName.charAt(0)}{candidateDetail.surname.charAt(0)}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{candidateDetail.firstName} {candidateDetail.surname}</h2>
                  <p className="text-sm text-muted-foreground">{candidateDetail.email}{candidateDetail.phone ? ` · ${candidateDetail.phone}` : ""}</p>
                </div>
                <div className="ml-auto"><StageBadge stage={candidateDetail.stage} /></div>
              </div>

              {/* Stage pipeline */}
              {candidateDetail.stage !== "hired" && candidateDetail.stage !== "rejected" && (
                <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-2">
                  {STAGES.filter(s => s !== "rejected" && s !== "hired").map((s, i) => {
                    const current = STAGES.indexOf(candidateDetail.stage as typeof STAGES[number]);
                    const idx = STAGES.indexOf(s);
                    const isActive = idx <= current;
                    return (
                      <button
                        key={s}
                        onClick={() => updateCandidateStage(candidateDetail.id, s).then(() => setCandidateDetail({ ...candidateDetail, stage: s }))}
                        className={`flex-1 text-center py-2 rounded-lg text-xs font-medium transition-colors ${isActive ? "bg-blue-600 text-white" : "text-muted-foreground hover:bg-muted"}`}
                      >
                        {STAGE_CONFIG[s].label}
                      </button>
                    );
                  })}
                </div>
              )}

              {editingCandidate ? (
                <div className="space-y-3 border-t pt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">First Name</Label><Input value={candidateEditForm.firstName || ""} onChange={e => setCandidateEditForm(p => ({ ...p, firstName: e.target.value }))} className="mt-1" /></div>
                    <div><Label className="text-xs">Surname</Label><Input value={candidateEditForm.surname || ""} onChange={e => setCandidateEditForm(p => ({ ...p, surname: e.target.value }))} className="mt-1" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">Email</Label><Input value={candidateEditForm.email || ""} onChange={e => setCandidateEditForm(p => ({ ...p, email: e.target.value }))} className="mt-1" /></div>
                    <div><Label className="text-xs">Phone</Label><Input value={candidateEditForm.phone || ""} onChange={e => setCandidateEditForm(p => ({ ...p, phone: e.target.value }))} className="mt-1" /></div>
                  </div>
                  <div><Label className="text-xs">Rating</Label><div className="mt-1"><StarRating value={candidateEditForm.rating ?? null} onChange={v => setCandidateEditForm(p => ({ ...p, rating: v }))} /></div></div>
                  <div><Label className="text-xs">Interview Notes</Label><textarea className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm min-h-[60px] resize-y" value={candidateEditForm.interviewNotes || ""} onChange={e => setCandidateEditForm(p => ({ ...p, interviewNotes: e.target.value }))} /></div>
                  <div><Label className="text-xs">Notes</Label><textarea className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm min-h-[60px] resize-y" value={candidateEditForm.notes || ""} onChange={e => setCandidateEditForm(p => ({ ...p, notes: e.target.value }))} /></div>
                  <div className="flex gap-2">
                    <Button onClick={updateCandidateDetails} disabled={submitting}>{submitting ? "Saving..." : "Save Changes"}</Button>
                    <Button variant="outline" onClick={() => setEditingCandidate(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 border-t pt-4">
                  {candidateDetail.rating && <div><p className="text-xs text-muted-foreground mb-1">Rating</p><StarRating value={candidateDetail.rating} /></div>}
                  {candidateDetail.notes && <div><p className="text-xs text-muted-foreground mb-1">Notes</p><p className="text-sm bg-muted/50 rounded-lg p-3">{candidateDetail.notes}</p></div>}
                  {candidateDetail.interviewNotes && <div><p className="text-xs text-muted-foreground mb-1">Interview Notes</p><p className="text-sm bg-muted/50 rounded-lg p-3">{candidateDetail.interviewNotes}</p></div>}
                  {candidateDetail.offerSalary && <div><p className="text-xs text-muted-foreground mb-1">Offer Salary</p><p className="text-sm font-medium">{candidateDetail.offerSalary}</p></div>}
                  <p className="text-xs text-muted-foreground">Applied {fmt(candidateDetail.createdAt)}</p>
                </div>
              )}

              {/* Action buttons */}
              {candidateDetail.stage !== "hired" && candidateDetail.stage !== "rejected" && isAdmin && (
                <div className="flex gap-2 pt-2 border-t">
                  {candidateDetail.stage === "offer" && (
                    <Button className="bg-green-600 hover:bg-green-700" onClick={() => { setHireDialog(candidateDetail); setHireForm({ startDate: new Date().toISOString().split("T")[0], probationDays: "90", startOnboarding: true }); setError(null); }}>
                      <UserPlus className="w-4 h-4 mr-1" /> Hire & Onboard
                    </Button>
                  )}
                  <Button variant="destructive" onClick={() => { updateCandidateStage(candidateDetail.id, "rejected"); setCandidateDetail({ ...candidateDetail, stage: "rejected" }); }}>
                    <XCircle className="w-4 h-4 mr-1" /> Reject
                  </Button>
                </div>
              )}
            </Card>
          ) : (
            /* PIPELINE VIEW */
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="font-bold text-lg">{selectedJob.title}</h3>
                  <p className="text-sm text-muted-foreground">{selectedJob.department ?? "—"}{selectedJob.site ? ` · ${selectedJob.site.name}` : ""} · {EMP_TYPES[selectedJob.employmentType] ?? selectedJob.employmentType}</p>
                </div>
                <div className="flex gap-2">
                  {isAdmin && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => openJobDialog(selectedJob)}><Edit2 className="w-3.5 h-3.5 mr-1" /> Edit Job</Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteJob(selectedJob.id)}><Trash2 className="w-3.5 h-3.5 mr-1" /> Delete</Button>
                    </>
                  )}
                  <Button size="sm" onClick={() => { setCandidateDialog(true); setError(null); setCandidateForm({ firstName: "", surname: "", email: "", phone: "", resumeText: "", coverLetter: "", notes: "" }); }}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Candidate
                  </Button>
                </div>
              </div>

              {selectedJob.description && <p className="text-sm text-muted-foreground">{selectedJob.description}</p>}

              {/* Stage filter */}
              <div className="flex gap-1 flex-wrap">
                <button onClick={() => setStageFilter("all")} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${stageFilter === "all" ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                  All ({candidates.length})
                </button>
                {STAGES.map(s => {
                  const count = candidates.filter(c => c.stage === s).length;
                  return (
                    <button key={s} onClick={() => setStageFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${stageFilter === s ? "bg-blue-600 text-white" : `${STAGE_CONFIG[s].color} hover:opacity-80`}`}>
                      {STAGE_CONFIG[s].label} ({count})
                    </button>
                  );
                })}
              </div>

              {candidatesLoading ? (
                <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-3 border-primary border-t-transparent rounded-full" /></div>
              ) : filteredCandidates.length === 0 ? (
                <Card className="p-8 text-center">
                  <Users className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{candidates.length === 0 ? "No candidates yet. Add candidates to start the pipeline." : "No candidates match the current filter."}</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {filteredCandidates.map(c => (
                    <Card key={c.id} className="p-3 cursor-pointer hover:shadow-md transition-all" onClick={() => setCandidateDetail(c)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                            {c.firstName.charAt(0)}{c.surname.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{c.firstName} {c.surname}</p>
                            <p className="text-xs text-muted-foreground">{c.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {c.rating && <StarRating value={c.rating} />}
                          <StageBadge stage={c.stage} />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* JOB DIALOG */}
      {jobDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <form onSubmit={handleJobSubmit} className="bg-background rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{editingJob ? "Edit Job Requisition" : "New Job Requisition"}</h2>
              <button type="button" onClick={() => setJobDialog(false)}><X className="w-5 h-5" /></button>
            </div>
            {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}

            <div><Label className="text-sm font-medium">Job Title *</Label><Input value={jobForm.title} onChange={e => setJobForm(p => ({ ...p, title: e.target.value }))} required className="mt-1" placeholder="e.g. Software Engineer" /></div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Department</Label>
                <Input value={jobForm.department} onChange={e => setJobForm(p => ({ ...p, department: e.target.value }))} className="mt-1" placeholder="e.g. Engineering" />
              </div>
              <div>
                <Label className="text-sm font-medium">Site</Label>
                <select value={jobForm.siteId} onChange={e => setJobForm(p => ({ ...p, siteId: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm">
                  <option value="">Select site</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-sm font-medium">Type</Label>
                <select value={jobForm.employmentType} onChange={e => setJobForm(p => ({ ...p, employmentType: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm">
                  {Object.entries(EMP_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-sm font-medium">Openings</Label>
                <Input type="number" min="1" value={jobForm.openings} onChange={e => setJobForm(p => ({ ...p, openings: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm font-medium">Status</Label>
                <select value={jobForm.status} onChange={e => setJobForm(p => ({ ...p, status: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm">
                  {Object.entries(JOB_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Hiring Manager</Label>
              <select value={jobForm.hiringManagerId} onChange={e => setJobForm(p => ({ ...p, hiringManagerId: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm">
                <option value="">Select manager</option>
                {allUsers.filter(u => u.department || true).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>

            <div><Label className="text-sm font-medium">Closing Date</Label><Input type="date" value={jobForm.closingDate} onChange={e => setJobForm(p => ({ ...p, closingDate: e.target.value }))} className="mt-1" /></div>

            <div><Label className="text-sm font-medium">Description</Label><textarea className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm min-h-[80px] resize-y" value={jobForm.description} onChange={e => setJobForm(p => ({ ...p, description: e.target.value }))} placeholder="Job description..." /></div>

            <div><Label className="text-sm font-medium">Requirements</Label><textarea className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm min-h-[60px] resize-y" value={jobForm.requirements} onChange={e => setJobForm(p => ({ ...p, requirements: e.target.value }))} placeholder="Requirements..." /></div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={submitting} className="flex-1">{submitting ? "Saving..." : editingJob ? "Save Changes" : "Create Job"}</Button>
              <button type="button" onClick={() => setJobDialog(false)} className="px-4 py-2 rounded-lg bg-secondary text-sm font-medium hover:bg-secondary/80">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* CANDIDATE DIALOG */}
      {candidateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <form onSubmit={handleCandidateSubmit} className="bg-background rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Add Candidate</h2>
              <button type="button" onClick={() => setCandidateDialog(false)}><X className="w-5 h-5" /></button>
            </div>
            {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}

            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-sm font-medium">First Name *</Label><Input value={candidateForm.firstName} onChange={e => setCandidateForm(p => ({ ...p, firstName: e.target.value }))} required className="mt-1" /></div>
              <div><Label className="text-sm font-medium">Surname *</Label><Input value={candidateForm.surname} onChange={e => setCandidateForm(p => ({ ...p, surname: e.target.value }))} required className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-sm font-medium">Email *</Label><Input type="email" value={candidateForm.email} onChange={e => setCandidateForm(p => ({ ...p, email: e.target.value }))} required className="mt-1" /></div>
              <div><Label className="text-sm font-medium">Phone</Label><Input value={candidateForm.phone} onChange={e => setCandidateForm(p => ({ ...p, phone: e.target.value }))} className="mt-1" /></div>
            </div>
            <div><Label className="text-sm font-medium">Notes</Label><textarea className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm min-h-[60px] resize-y" value={candidateForm.notes} onChange={e => setCandidateForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any initial notes..." /></div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={submitting} className="flex-1">{submitting ? "Adding..." : "Add Candidate"}</Button>
              <button type="button" onClick={() => setCandidateDialog(false)} className="px-4 py-2 rounded-lg bg-secondary text-sm font-medium hover:bg-secondary/80">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* HIRE DIALOG */}
      {hireDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2"><UserPlus className="w-5 h-5 text-green-600" /> Hire & Onboard</h2>
            <p className="text-sm text-muted-foreground">
              Hiring <strong>{hireDialog.firstName} {hireDialog.surname}</strong> will create a user account (default password: <code className="bg-muted px-1 rounded">changeme123</code>) and optionally start an onboarding workflow.
            </p>
            {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}

            <div><Label className="text-sm font-medium">Start Date *</Label><Input type="date" value={hireForm.startDate} onChange={e => setHireForm(p => ({ ...p, startDate: e.target.value }))} className="mt-1" /></div>
            <div><Label className="text-sm font-medium">Probation Period (days)</Label><Input type="number" value={hireForm.probationDays} onChange={e => setHireForm(p => ({ ...p, probationDays: e.target.value }))} className="mt-1" placeholder="90" /></div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={hireForm.startOnboarding} onChange={e => setHireForm(p => ({ ...p, startOnboarding: e.target.checked }))} className="rounded" />
              <span className="text-sm font-medium">Start onboarding workflow automatically</span>
            </label>

            <div className="flex gap-3 pt-2">
              <Button onClick={handleHire} disabled={submitting} className="flex-1 bg-green-600 hover:bg-green-700">{submitting ? "Processing..." : "Confirm Hire"}</Button>
              <button onClick={() => setHireDialog(null)} className="px-4 py-2 rounded-lg bg-secondary text-sm font-medium hover:bg-secondary/80">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
