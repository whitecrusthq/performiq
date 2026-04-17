import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { apiFetch } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Briefcase, MapPin, Clock, Building2, ChevronRight, Search,
  Upload, CheckCircle2, ArrowLeft, FileText, Send, User, Mail,
  Phone, Globe, GraduationCap, Calendar, Loader2
} from "lucide-react";

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: "Full-time", part_time: "Part-time", contract: "Contract",
  intern: "Internship", temporary: "Temporary",
};

interface Job {
  id: number; title: string; department: string | null; siteName: string | null;
  description: string | null; requirements: string | null; employmentType: string;
  openings: number; closingDate: string | null; createdAt: string;
}

interface Company { companyName: string; logoLetter: string; primaryHsl: string; }

function CareersHeader({ company }: { company: Company }) {
  const primaryColor = `hsl(${company.primaryHsl})`;
  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: primaryColor }}>
            {company.logoLetter}
          </div>
          <span className="text-xl font-bold">{company.companyName}</span>
        </div>
        <h1 className="text-4xl font-bold mb-3">Join Our Team</h1>
        <p className="text-lg text-slate-300 max-w-2xl">Explore open positions and find your next career opportunity with us.</p>
      </div>
    </div>
  );
}

function JobList({ jobs, onSelect, search, setSearch }: {
  jobs: Job[]; onSelect: (j: Job) => void; search: string; setSearch: (s: string) => void;
}) {
  const filtered = jobs.filter(j =>
    j.title.toLowerCase().includes(search.toLowerCase()) ||
    (j.department || "").toLowerCase().includes(search.toLowerCase())
  );

  const departments = [...new Set(jobs.map(j => j.department).filter(Boolean))] as string[];

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search positions by title or department..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Badge variant="secondary" className="text-sm px-3 py-1.5">{filtered.length} open position{filtered.length !== 1 ? "s" : ""}</Badge>
      </div>

      {departments.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={() => setSearch("")} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!search ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}>All</button>
          {departments.map(d => (
            <button key={d} onClick={() => setSearch(d)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${search === d ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}>{d}</button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No positions found</p>
          <p className="text-sm mt-1">Try adjusting your search or check back later.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(job => (
            <Card key={job.id} className="cursor-pointer hover:shadow-md transition-all hover:border-primary/30" onClick={() => onSelect(job)}>
              <CardContent className="py-5">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{job.title}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                      {job.department && <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{job.department}</span>}
                      {job.siteName && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.siteName}</span>}
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{EMPLOYMENT_LABELS[job.employmentType] || job.employmentType}</span>
                      {job.openings > 1 && <Badge variant="outline" className="text-xs">{job.openings} openings</Badge>}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function JobDetail({ job, company, onBack, onApply }: {
  job: Job; company: Company; onBack: () => void; onApply: () => void;
}) {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to all positions
      </button>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-3">{job.title}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {job.department && <span className="flex items-center gap-1"><Building2 className="h-4 w-4" />{job.department}</span>}
              {job.siteName && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{job.siteName}</span>}
              <Badge>{EMPLOYMENT_LABELS[job.employmentType] || job.employmentType}</Badge>
            </div>
          </div>

          {job.description && (
            <Card>
              <CardHeader><CardTitle className="text-lg">About the Role</CardTitle></CardHeader>
              <CardContent><div className="prose prose-sm max-w-none whitespace-pre-wrap text-muted-foreground">{job.description}</div></CardContent>
            </Card>
          )}

          {job.requirements && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Requirements</CardTitle></CardHeader>
              <CardContent><div className="prose prose-sm max-w-none whitespace-pre-wrap text-muted-foreground">{job.requirements}</div></CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <Button onClick={onApply} className="w-full" size="lg">
                <Send className="h-4 w-4 mr-2" /> Apply Now
              </Button>
              <div className="space-y-3 text-sm">
                {job.openings > 1 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Openings</span><span className="font-medium">{job.openings}</span></div>
                )}
                {job.closingDate && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Closing Date</span><span className="font-medium">{new Date(job.closingDate).toLocaleDateString()}</span></div>
                )}
                <div className="flex justify-between"><span className="text-muted-foreground">Posted</span><span className="font-medium">{new Date(job.createdAt).toLocaleDateString()}</span></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ApplicationForm({ job, company, onBack, onSuccess }: {
  job: Job; company: Company; onBack: () => void;
  onSuccess: (token: string) => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.firstName || !form.surname || !form.email) {
      setError("Please fill in all required fields."); return;
    }

    setSubmitting(true);
    try {
      let resumeUrl = null;
      if (resumeFile) {
        const urlRes = await apiFetch("/api/careers/upload-url", { method: "POST" });
        const urlData = await urlRes.json();
        if (!urlRes.ok) throw new Error("Failed to get upload URL");

        await fetch(urlData.uploadURL, {
          method: "PUT",
          body: resumeFile,
          headers: { "Content-Type": resumeFile.type },
        });

        const objectId = urlData.objectPath.split("/").pop();
        resumeUrl = `/api/storage/objects/${objectId}`;
      }

      const res = await apiFetch(`/api/careers/apply/${job.id}`, {
        method: "POST",
        body: JSON.stringify({
          ...form,
          resumeUrl,
          experienceYears: form.experienceYears ? Number(form.experienceYears) : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit application");

      onSuccess(data.applicationToken);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to job details
      </button>

      <h1 className="text-2xl font-bold mb-1">Apply for {job.title}</h1>
      <p className="text-muted-foreground mb-8">{job.department && `${job.department} · `}{EMPLOYMENT_LABELS[job.employmentType] || job.employmentType}</p>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><User className="h-4 w-4" /> Personal Information</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>First Name <span className="text-red-500">*</span></Label>
              <Input value={form.firstName || ""} onChange={e => set("firstName", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Surname <span className="text-red-500">*</span></Label>
              <Input value={form.surname || ""} onChange={e => set("surname", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> Email <span className="text-red-500">*</span></Label>
              <Input type="email" value={form.email || ""} onChange={e => set("email", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> Phone</Label>
              <Input value={form.phone || ""} onChange={e => set("phone", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input value={form.address || ""} onChange={e => set("address", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input value={form.city || ""} onChange={e => set("city", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Briefcase className="h-4 w-4" /> Professional Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Current Job Title</Label>
              <Input value={form.currentJobTitle || ""} onChange={e => set("currentJobTitle", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Current Employer</Label>
              <Input value={form.currentEmployer || ""} onChange={e => set("currentEmployer", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Years of Experience</Label>
              <Input type="number" min="0" value={form.experienceYears || ""} onChange={e => set("experienceYears", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" /> Education</Label>
              <Input value={form.education || ""} onChange={e => set("education", e.target.value)} placeholder="e.g., BSc Computer Science" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> LinkedIn Profile</Label>
              <Input value={form.linkedin || ""} onChange={e => set("linkedin", e.target.value)} placeholder="https://linkedin.com/in/..." />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><span className="font-semibold text-base leading-none">₦</span> Expected Salary (NGN)</Label>
              <Input value={form.expectedSalary || ""} onChange={e => set("expectedSalary", e.target.value)} placeholder="e.g. 250,000" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Available Start Date</Label>
              <Input type="date" value={form.availableStartDate || ""} onChange={e => set("availableStartDate", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" /> Documents</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>CV / Resume</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={e => setResumeFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="resume-upload"
                />
                <label htmlFor="resume-upload" className="cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  {resumeFile ? (
                    <div>
                      <p className="font-medium text-sm">{resumeFile.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{(resumeFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium text-sm">Click to upload your CV</p>
                      <p className="text-xs text-muted-foreground mt-1">PDF, DOC, or DOCX (max 10MB)</p>
                    </div>
                  )}
                </label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Cover Letter</Label>
              <Textarea
                value={form.coverLetter || ""}
                onChange={e => set("coverLetter", e.target.value)}
                placeholder="Tell us why you're interested in this role and what makes you a great fit..."
                rows={5}
              />
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
        )}

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={submitting} size="lg" className="px-8">
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</> : <><Send className="h-4 w-4 mr-2" /> Submit Application</>}
          </Button>
          <p className="text-xs text-muted-foreground">By submitting, you agree to us processing your data for recruitment purposes.</p>
        </div>
      </form>
    </div>
  );
}

function ApplicationSuccess({ token, company }: { token: string; company: Company }) {
  const trackingUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/careers/track/${token}`;

  return (
    <div className="max-w-2xl mx-auto px-6 py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
        <CheckCircle2 className="h-8 w-8 text-green-600" />
      </div>
      <h1 className="text-3xl font-bold mb-3">Application Submitted!</h1>
      <p className="text-muted-foreground text-lg mb-8">
        Thank you for applying. We have received your application and will review it carefully. You will receive email updates as your application progresses.
      </p>
      <Card className="text-left">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2">Track Your Application</h3>
          <p className="text-sm text-muted-foreground mb-3">Save this link to check the status of your application at any time:</p>
          <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <code className="text-xs break-all flex-1">{trackingUrl}</code>
            <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(trackingUrl)}>Copy</Button>
          </div>
        </CardContent>
      </Card>
      <div className="mt-8">
        <a href={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/careers`} className="text-primary hover:underline text-sm">View more open positions</a>
      </div>
    </div>
  );
}

function ApplicationTracker({ token }: { token: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`/api/careers/application/${token}`)
      .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e.error)))
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (error) return (
    <div className="max-w-2xl mx-auto px-6 py-16 text-center">
      <h2 className="text-2xl font-bold mb-3">Application Not Found</h2>
      <p className="text-muted-foreground">We could not find an application with this tracking link. Please check the link and try again.</p>
    </div>
  );

  const { candidate, job, timeline, isRejected, rejectionReason } = data;

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold mb-2">Application Status</h1>
      <p className="text-muted-foreground mb-8">
        {candidate.firstName} {candidate.surname} — {job?.title || "Position"}
        {job?.department && ` · ${job.department}`}
      </p>

      {isRejected && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-red-800 mb-1">Application Not Selected</h3>
          <p className="text-sm text-red-700">{rejectionReason}</p>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-0">
            {timeline.map((step: any, i: number) => (
              <div key={step.stage} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    step.status === "completed" ? "bg-green-100 text-green-600" :
                    step.status === "current" ? "bg-primary text-primary-foreground" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {step.status === "completed" ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                  </div>
                  {i < timeline.length - 1 && (
                    <div className={`w-0.5 h-12 ${step.status === "completed" ? "bg-green-200" : "bg-muted"}`} />
                  )}
                </div>
                <div className="pb-8">
                  <h4 className={`font-semibold text-sm ${step.status === "current" ? "text-primary" : step.status === "completed" ? "text-foreground" : "text-muted-foreground"}`}>
                    {step.label}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 text-center">
        <p className="text-xs text-muted-foreground">Applied on {new Date(candidate.appliedAt).toLocaleDateString()} · Last updated {new Date(candidate.updatedAt).toLocaleDateString()}</p>
      </div>
    </div>
  );
}

export default function Careers() {
  const [company, setCompany] = useState<Company>({ companyName: "Company", logoLetter: "C", primaryHsl: "221 83% 53%" });
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [view, setView] = useState<"list" | "detail" | "apply" | "success">("list");
  const [search, setSearch] = useState("");
  const [successToken, setSuccessToken] = useState("");

  const [, params] = useRoute("/careers/track/:token");
  const trackingToken = params?.token;

  useEffect(() => {
    Promise.all([
      apiFetch("/api/careers/company").then(r => r.json()).then(setCompany).catch(() => {}),
      apiFetch("/api/careers/jobs").then(r => r.json()).then(setJobs).catch(() => []),
    ]).finally(() => setLoading(false));
  }, []);

  if (trackingToken) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white">
          <div className="max-w-4xl mx-auto px-6 py-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: `hsl(${company.primaryHsl})` }}>
                {company.logoLetter}
              </div>
              <span className="text-lg font-bold">{company.companyName}</span>
            </div>
          </div>
        </div>
        <ApplicationTracker token={trackingToken} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <CareersHeader company={company} />
      {view === "list" && <JobList jobs={jobs} onSelect={j => { setSelectedJob(j); setView("detail"); }} search={search} setSearch={setSearch} />}
      {view === "detail" && selectedJob && <JobDetail job={selectedJob} company={company} onBack={() => setView("list")} onApply={() => setView("apply")} />}
      {view === "apply" && selectedJob && (
        <ApplicationForm job={selectedJob} company={company} onBack={() => setView("detail")}
          onSuccess={token => { setSuccessToken(token); setView("success"); }} />
      )}
      {view === "success" && <ApplicationSuccess token={successToken} company={company} />}
    </div>
  );
}
