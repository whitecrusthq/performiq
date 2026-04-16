import { useState, useEffect, useCallback } from "react";
import { PageHeader, Card, Button, Label } from "@/components/shared";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  UserPlus, UserMinus, CheckCircle2, Clock, AlertCircle, Plus, X,
  ChevronDown, ChevronRight, Edit2, Trash2, FileText, Users, Settings,
  RefreshCw, Search, Filter, Check, SkipForward, CircleDot,
  Upload, Download, File, ListTodo, Eye,
} from "lucide-react";
import { format } from "date-fns";
import { apiFetch } from "@/lib/utils";

const CATEGORY_COLORS: Record<string, string> = {
  "Pre-boarding & Documentation":    "bg-purple-100 text-purple-700",
  "IT & Asset Setup":                "bg-blue-100 text-blue-700",
  "Orientation & Training":          "bg-green-100 text-green-700",
  "Welcome & Engagement":            "bg-yellow-100 text-yellow-700",
  "Resignation/Termination Processing": "bg-orange-100 text-orange-700",
  "Asset & Access Management":       "bg-red-100 text-red-700",
  "Knowledge Transfer & Transition": "bg-indigo-100 text-indigo-700",
  "Finalization & Exit":             "bg-emerald-100 text-emerald-700",
  "General":                         "bg-gray-100 text-gray-700",
};

const TASK_STATUS_CONFIG = {
  pending:     { label: "Pending",     color: "bg-gray-100 text-gray-600",  icon: CircleDot },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-700",  icon: RefreshCw },
  completed:   { label: "Completed",   color: "bg-green-100 text-green-700",icon: CheckCircle2 },
  skipped:     { label: "Skipped",     color: "bg-yellow-100 text-yellow-700", icon: SkipForward },
};

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div
        className={`h-2 rounded-full transition-all duration-500 ${value === 100 ? "bg-green-500" : "bg-primary"}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

// ─── Start Workflow Dialog ────────────────────────────────────────────────────

function StartWorkflowDialog({
  open, onClose, templates, users, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  templates: any[];
  users: any[];
  onCreated: (wf: any) => void;
}) {
  const [type, setType] = useState<"onboarding" | "offboarding">("onboarding");
  const [employeeId, setEmployeeId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [customizeTasks, setCustomizeTasks] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [enableProbation, setEnableProbation] = useState(false);
  const [probationDays, setProbationDays] = useState("90");
  const { toast } = useToast();

  const filtered = templates.filter(t => t.type === type);

  useEffect(() => {
    if (!open) return;
    setType("onboarding"); setEmployeeId(""); setTemplateId("");
    setTitle(""); setNotes(""); setTargetDate(""); setCustomizeTasks(false); setTasks([]);
    setEnableProbation(false); setProbationDays("90");
  }, [open]);

  useEffect(() => {
    const tmpl = templates.find(t => t.id === parseInt(templateId));
    if (tmpl) {
      setTitle(title || tmpl.name);
      setTasks(tmpl.tasks.map((t: any) => ({ ...t, assigneeId: "" })));
    } else {
      setTasks([]);
    }
  }, [templateId]);

  const addTask = () => setTasks(prev => [...prev, { title: "", description: "", category: "", assigneeId: "", dueInDays: "" }]);
  const removeTask = (i: number) => setTasks(prev => prev.filter((_, idx) => idx !== i));
  const updateTask = (i: number, field: string, val: string) =>
    setTasks(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: val } : t));

  const handleSubmit = async () => {
    if (!employeeId || !title.trim()) { toast({ title: "Employee and title required", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const body: any = { employeeId, type, title, notes, targetCompletionDate: targetDate || undefined, templateId: templateId || undefined, probationDays: (type === "onboarding" && enableProbation && probationDays) ? probationDays : undefined };
      if (customizeTasks) {
        body.tasks = tasks.filter(t => t.title.trim()).map(t => ({
          title: t.title, description: t.description, category: t.category,
          assigneeId: t.assigneeId || undefined,
          dueInDays: t.dueInDays ? parseInt(t.dueInDays) : undefined,
        }));
      }
      const res = await apiFetch(`/api/onboarding/workflows`, { method: "POST", body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).error);
      const wf = await res.json();
      onCreated(wf);
      toast({ title: `${type === "onboarding" ? "Onboarding" : "Offboarding"} started successfully` });
      onClose();
    } catch (err: any) {
      toast({ title: err.message || "Failed to start workflow", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-background rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold">Start New Workflow</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Type selector */}
          <div>
            <Label>Workflow Type</Label>
            <div className="flex gap-3 mt-2">
              {(["onboarding", "offboarding"] as const).map(t => (
                <button key={t} onClick={() => { setType(t); setTemplateId(""); setTasks([]); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-semibold capitalize transition-all ${type === t ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-muted-foreground"}`}>
                  {t === "onboarding" ? <UserPlus className="w-4 h-4" /> : <UserMinus className="w-4 h-4" />}
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Employee */}
          <div>
            <Label>Employee *</Label>
            <select value={employeeId} onChange={e => setEmployeeId(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none">
              <option value="">Select employee...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} — {u.jobTitle || u.role}</option>)}
            </select>
          </div>

          {/* Template */}
          <div>
            <Label>Template (optional)</Label>
            <select value={templateId} onChange={e => setTemplateId(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none">
              <option value="">No template (blank checklist)</option>
              {filtered.map(t => <option key={t.id} value={t.id}>{t.name}{t.isDefault ? " (default)" : ""}</option>)}
            </select>
          </div>

          {/* Title */}
          <div>
            <Label>Workflow Title *</Label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="e.g. John Doe — Onboarding" />
          </div>

          {/* Target date */}
          <div>
            <Label>Target Completion Date</Label>
            <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none" />
          </div>

          {/* Notes */}
          <div>
            <Label>Notes</Label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full mt-1 px-3 py-2 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none resize-none"
              placeholder="Any additional context..." />
          </div>

          {/* Probation Period (onboarding only) */}
          {type === "onboarding" && (
            <div className="border border-border rounded-xl p-4 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={enableProbation} onChange={e => setEnableProbation(e.target.checked)} className="rounded accent-primary w-4 h-4" />
                <span className="text-sm font-medium">Enable Probation Period</span>
              </label>
              {enableProbation && (
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Label>Duration (days)</Label>
                    <input type="number" min="1" value={probationDays} onChange={e => setProbationDays(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                      placeholder="e.g. 90" />
                  </div>
                  <div className="flex-1">
                    <Label>Ends on</Label>
                    <p className="mt-1 px-3 py-2 text-sm text-muted-foreground">
                      {probationDays && parseInt(probationDays) > 0
                        ? format(new Date(Date.now() + parseInt(probationDays) * 86400000), "MMM d, yyyy")
                        : "—"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Customise tasks */}
          {templateId && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={customizeTasks} onChange={e => setCustomizeTasks(e.target.checked)} className="rounded" />
              <span className="text-sm">Customise tasks before starting</span>
            </label>
          )}

          {/* Task editor */}
          {(customizeTasks || !templateId) && (
            <div className="border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Checklist Tasks ({tasks.length})</h4>
                <Button size="sm" variant="outline" onClick={addTask}><Plus className="w-4 h-4 mr-1" /> Add Task</Button>
              </div>
              {tasks.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No tasks yet. Add tasks or choose a template.</p>
              )}
              {tasks.map((task, i) => (
                <div key={i} className="bg-muted/40 rounded-xl p-3 space-y-2">
                  <div className="flex gap-2">
                    <input value={task.title} onChange={e => updateTask(i, "title", e.target.value)}
                      placeholder="Task title *" className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-sm outline-none" />
                    <button onClick={() => removeTask(i)} className="p-1.5 rounded-lg hover:bg-red-100 hover:text-red-600 text-muted-foreground"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={task.category} onChange={e => updateTask(i, "category", e.target.value)}
                      placeholder="Category" className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm outline-none" />
                    <input type="number" value={task.dueInDays} onChange={e => updateTask(i, "dueInDays", e.target.value)}
                      placeholder="Due in N days" className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm outline-none" />
                  </div>
                  <select value={task.assigneeId} onChange={e => updateTask(i, "assigneeId", e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm outline-none">
                    <option value="">Assign to... (optional)</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={loading}>
              {loading ? "Starting..." : `Start ${type === "onboarding" ? "Onboarding" : "Offboarding"}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Workflow Detail Panel ────────────────────────────────────────────────────

function WorkflowDetail({
  workflowInit, users, canManage, onUpdate, onClose, onStartNew,
}: {
  workflowInit: any;
  users: any[];
  canManage: boolean;
  onUpdate: (wf: any) => void;
  onClose: () => void;
  onStartNew?: () => void;
}) {
  const { toast } = useToast();
  const [workflow, setWorkflow] = useState<any>(workflowInit);
  const [loading, setLoading] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", description: "", category: "", assigneeId: "", dueDate: "" });
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);
  const [expandedTask, setExpandedTask] = useState<number | null>(null);
  const [editingTask, setEditingTask] = useState<number | null>(null);
  const [taskDraft, setTaskDraft] = useState<any>({});
  const [editingHeader, setEditingHeader] = useState(false);
  const [headerDraft, setHeaderDraft] = useState({ title: "", notes: "", targetCompletionDate: "" });
  const [activeTab, setActiveTab] = useState<"tasks" | "documents">("tasks");
  const [documents, setDocuments] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docNotes, setDocNotes] = useState("");
  const [viewingDoc, setViewingDoc] = useState<{ name: string; fileData: string; fileType: string } | null>(null);

  // Fetch fresh workflow data from server
  const refresh = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/onboarding/workflows/${id}`);
      if (res.ok) {
        const data = await res.json();
        setWorkflow(data);
        onUpdate(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh(workflowInit.id);
  }, [workflowInit.id]);

  const pushUpdate = (updated: any) => {
    setWorkflow(updated);
    onUpdate(updated);
  };

  const fetchDocuments = useCallback(async (id: number) => {
    setDocsLoading(true);
    try {
      const res = await apiFetch(`/api/onboarding/workflows/${id}/documents`);
      if (res.ok) setDocuments(await res.json());
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "documents") fetchDocuments(workflow.id);
  }, [activeTab, workflow.id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    const readAsBase64 = (file: File): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = ev => resolve((ev.target?.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    try {
      const uploaded: any[] = [];
      for (const file of files) {
        const base64 = await readAsBase64(file);
        const res = await apiFetch(`/api/onboarding/workflows/${workflow.id}/documents`, {
          method: "POST",
          body: JSON.stringify({ name: file.name, fileData: base64, fileType: file.type, notes: docNotes }),
        });
        if (!res.ok) throw new Error(`Failed to upload ${file.name}`);
        uploaded.push(await res.json());
      }
      setDocuments(prev => [...uploaded.reverse(), ...prev]);
      setDocNotes("");
      toast({ title: uploaded.length === 1 ? "Document uploaded" : `${uploaded.length} documents uploaded` });
    } catch (err: any) {
      toast({ title: err.message || "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const downloadDoc = async (doc: any) => {
    try {
      const res = await apiFetch(`/api/onboarding/documents/${doc.id}/download`);
      if (!res.ok) throw new Error();
      const { fileData, fileType, name } = await res.json();
      if (!fileData) { toast({ title: "No file data", variant: "destructive" }); return; }
      const blob = new Blob([Uint8Array.from(atob(fileData), c => c.charCodeAt(0))], { type: fileType || "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  const deleteDoc = async (docId: number) => {
    if (!confirm("Delete this document?")) return;
    try {
      await apiFetch(`/api/onboarding/documents/${docId}`, { method: "DELETE" });
      setDocuments(prev => prev.filter(d => d.id !== docId));
      toast({ title: "Document deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const viewDoc = async (doc: any) => {
    try {
      const res = await apiFetch(`/api/onboarding/documents/${doc.id}/download`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (!data.fileData) { toast({ title: "No file data available", variant: "destructive" }); return; }
      setViewingDoc({ name: data.name, fileData: data.fileData, fileType: data.fileType || "" });
    } catch {
      toast({ title: "Failed to load document", variant: "destructive" });
    }
  };

  const updateTask = async (taskId: number, patch: any) => {
    setUpdatingTaskId(taskId);
    try {
      const res = await apiFetch(`/api/onboarding/tasks/${taskId}`, {
        method: "PATCH", body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      pushUpdate(await res.json());
      setEditingTask(null);
    } catch (err: any) {
      toast({ title: err.message || "Failed to update task", variant: "destructive" });
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const deleteTask = async (taskId: number) => {
    if (!confirm("Delete this task?")) return;
    try {
      const res = await apiFetch(`/api/onboarding/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      pushUpdate(await res.json());
      toast({ title: "Task deleted" });
    } catch {
      toast({ title: "Failed to delete task", variant: "destructive" });
    }
  };

  const addTask = async () => {
    if (!newTask.title.trim()) { toast({ title: "Task title required", variant: "destructive" }); return; }
    try {
      const res = await apiFetch(`/api/onboarding/workflows/${workflow.id}/tasks`, {
        method: "POST", body: JSON.stringify({
          ...newTask, assigneeId: newTask.assigneeId || undefined, dueDate: newTask.dueDate || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      pushUpdate(await res.json());
      setNewTask({ title: "", description: "", category: "", assigneeId: "", dueDate: "" });
      setAddingTask(false);
      toast({ title: "Task added" });
    } catch (err: any) {
      toast({ title: err.message || "Failed to add task", variant: "destructive" });
    }
  };

  const updateWorkflowMeta = async (patch: any) => {
    try {
      const res = await apiFetch(`/api/onboarding/workflows/${workflow.id}`, {
        method: "PUT", body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      pushUpdate(await res.json());
      setEditingHeader(false);
      toast({ title: "Workflow updated" });
    } catch {
      toast({ title: "Failed to update workflow", variant: "destructive" });
    }
  };

  const groupedTasks: Record<string, any[]> = {};
  (workflow.tasks || []).forEach((t: any) => {
    const cat = t.category || "General";
    if (!groupedTasks[cat]) groupedTasks[cat] = [];
    groupedTasks[cat].push(t);
  });

  const startEditTask = (task: any) => {
    setEditingTask(task.id);
    setTaskDraft({
      title: task.title,
      description: task.description || "",
      category: task.category || "",
      notes: task.notes || "",
      dueDate: task.dueDate ? task.dueDate.split("T")[0] : "",
      assigneeId: task.assigneeId ? String(task.assigneeId) : "",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/30 backdrop-blur-sm">
      <div className="bg-background h-full w-full max-w-xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className={`px-6 py-4 border-b border-border ${workflow.type === "onboarding" ? "bg-blue-50 dark:bg-blue-950/30" : "bg-red-50 dark:bg-red-950/30"}`}>
          {editingHeader && canManage ? (
            <div className="space-y-2">
              <input
                value={headerDraft.title}
                onChange={e => setHeaderDraft(p => ({ ...p, title: e.target.value }))}
                className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm font-semibold outline-none"
                placeholder="Workflow title"
              />
              <textarea
                value={headerDraft.notes}
                onChange={e => setHeaderDraft(p => ({ ...p, notes: e.target.value }))}
                rows={2}
                className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm outline-none resize-none"
                placeholder="Notes (optional)"
              />
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground shrink-0">Target date:</label>
                <input
                  type="date"
                  value={headerDraft.targetCompletionDate}
                  onChange={e => setHeaderDraft(p => ({ ...p, targetCompletionDate: e.target.value }))}
                  className="flex-1 px-2 py-1 rounded-lg border border-border bg-background text-xs outline-none"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditingHeader(false)}
                  className="flex-1 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted">Cancel</button>
                <button onClick={() => updateWorkflowMeta({
                  title: headerDraft.title,
                  notes: headerDraft.notes || null,
                  targetCompletionDate: headerDraft.targetCompletionDate || null,
                })} className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90">
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {workflow.type === "onboarding"
                      ? <UserPlus className="w-5 h-5 text-blue-600 shrink-0" />
                      : <UserMinus className="w-5 h-5 text-red-600 shrink-0" />}
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${workflow.type === "onboarding" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>
                      {workflow.type}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                      workflow.status === "completed" ? "bg-green-100 text-green-700"
                      : workflow.status === "cancelled" ? "bg-gray-100 text-gray-600"
                      : "bg-primary/10 text-primary"}`}>
                      {workflow.status}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold">{workflow.title}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {workflow.employee?.name}
                    {workflow.startedBy?.name && ` · Started by ${workflow.startedBy.name}`}
                  </p>
                  {workflow.notes && <p className="text-xs text-muted-foreground italic mt-1">{workflow.notes}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {canManage && onStartNew && (
                    <button onClick={onStartNew}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
                      title="Start another workflow">
                      <Plus className="w-3.5 h-3.5" /> New
                    </button>
                  )}
                  {canManage && (
                    <button onClick={() => {
                      setHeaderDraft({
                        title: workflow.title,
                        notes: workflow.notes || "",
                        targetCompletionDate: workflow.targetCompletionDate ? workflow.targetCompletionDate.split("T")[0] : "",
                      });
                      setEditingHeader(true);
                    }} className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground" title="Edit workflow">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => refresh(workflow.id)} className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground" title="Refresh">
                    <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  </button>
                  <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/60"><X className="w-5 h-5" /></button>
                </div>
              </div>

              {/* Progress */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">
                    {workflow.completedTasks}/{workflow.totalTasks} tasks done
                  </span>
                  <span className="text-xs font-bold text-primary">{workflow.progress}%</span>
                </div>
                <ProgressBar value={workflow.progress ?? 0} />
              </div>

              {workflow.targetCompletionDate && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Target: {format(new Date(workflow.targetCompletionDate), "MMM d, yyyy")}
                </p>
              )}

              {workflow.type === "onboarding" && workflow.employee?.probationEndDate && (() => {
                const end = new Date(workflow.employee.probationEndDate);
                const daysLeft = Math.ceil((end.getTime() - Date.now()) / 86400000);
                const status = workflow.employee.probationStatus ?? "active";
                const cfg: Record<string, { label: string; color: string }> = {
                  active: { label: "On Probation", color: "bg-amber-100 text-amber-700" },
                  extended: { label: "Extended", color: "bg-orange-100 text-orange-700" },
                  confirmed: { label: "Confirmed", color: "bg-green-100 text-green-700" },
                  failed: { label: "Failed", color: "bg-red-100 text-red-700" },
                };
                const sc = cfg[status] ?? cfg.active;
                return (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sc.color}`}>{sc.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {(status === "active" || status === "extended")
                        ? daysLeft <= 0 ? "Ended — awaiting decision" : `${daysLeft}d left (ends ${format(end, "MMM d, yyyy")})`
                        : `Ended ${format(end, "MMM d, yyyy")}`}
                    </span>
                  </div>
                );
              })()}
            </>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-border px-4 bg-background shrink-0">
          {([["tasks", "Tasks", ListTodo], ["documents", "Documents", File]] as const).map(([key, label, Icon]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <Icon className="w-4 h-4" />{label}
              {key === "documents" && documents.length > 0 && (
                <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold">{documents.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tasks */}
        {activeTab === "tasks" && <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && (workflow.tasks || []).length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              <RefreshCw className="w-8 h-8 mx-auto mb-2 opacity-30 animate-spin" />
              <p className="text-sm">Loading tasks…</p>
            </div>
          )}
          {!loading && Object.keys(groupedTasks).length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No tasks in this workflow yet.</p>
              {canManage && workflow.status === "active" && (
                <button onClick={() => setAddingTask(true)}
                  className="mt-3 text-sm text-primary hover:underline">Add the first task</button>
              )}
            </div>
          )}

          {Object.entries(groupedTasks).map(([category, catTasks]) => (
            <div key={category}>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1 flex items-center gap-2">
                <span className={`inline-block w-2 h-2 rounded-full ${CATEGORY_COLORS[category]?.includes("purple") ? "bg-purple-400" : CATEGORY_COLORS[category]?.includes("blue") ? "bg-blue-400" : CATEGORY_COLORS[category]?.includes("green") ? "bg-green-400" : "bg-gray-400"}`} />
                {category}
                <span className="font-normal opacity-60">({catTasks.filter(t => t.status === "completed" || t.status === "skipped").length}/{catTasks.length})</span>
              </h4>
              <div className="space-y-2">
                {catTasks.map((task: any) => {
                  const cfg = TASK_STATUS_CONFIG[task.status as keyof typeof TASK_STATUS_CONFIG] ?? TASK_STATUS_CONFIG.pending;
                  const Icon = cfg.icon;
                  const isExpanded = expandedTask === task.id;
                  const isEditing = editingTask === task.id;

                  return (
                    <div key={task.id} className="border border-border rounded-xl bg-background overflow-hidden">
                      {/* Row */}
                      <div
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => {
                          if (isExpanded) { setExpandedTask(null); setEditingTask(null); }
                          else setExpandedTask(task.id);
                        }}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${task.status === "completed" ? "text-green-600" : task.status === "in_progress" ? "text-blue-600" : task.status === "skipped" ? "text-yellow-600" : "text-muted-foreground"}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {task.assignee && <span className="text-xs text-muted-foreground">→ {task.assignee.name}</span>}
                            {task.dueDate && (
                              <span className={`text-xs ${new Date(task.dueDate) < new Date() && task.status !== "completed" ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                                Due {format(new Date(task.dueDate), "MMM d")}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-medium ${cfg.color}`}>{cfg.label}</span>
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                      </div>

                      {/* Expanded area */}
                      {isExpanded && (
                        <div className="border-t border-border px-4 py-3 space-y-3 bg-muted/20">
                          {isEditing ? (
                            /* Edit mode */
                            <div className="space-y-2">
                              <input value={taskDraft.title}
                                onChange={e => setTaskDraft((p: any) => ({ ...p, title: e.target.value }))}
                                placeholder="Task title *"
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none font-medium" />
                              <textarea value={taskDraft.description}
                                onChange={e => setTaskDraft((p: any) => ({ ...p, description: e.target.value }))}
                                placeholder="Description"
                                rows={2}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none resize-none" />
                              <div className="grid grid-cols-2 gap-2">
                                <input value={taskDraft.category}
                                  onChange={e => setTaskDraft((p: any) => ({ ...p, category: e.target.value }))}
                                  placeholder="Category"
                                  className="px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none" />
                                <input type="date" value={taskDraft.dueDate}
                                  onChange={e => setTaskDraft((p: any) => ({ ...p, dueDate: e.target.value }))}
                                  className="px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none" />
                              </div>
                              <select value={taskDraft.assigneeId}
                                onChange={e => setTaskDraft((p: any) => ({ ...p, assigneeId: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none">
                                <option value="">Unassigned</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                              </select>
                              <textarea value={taskDraft.notes}
                                onChange={e => setTaskDraft((p: any) => ({ ...p, notes: e.target.value }))}
                                placeholder="Notes / comments"
                                rows={2}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none resize-none" />
                              <div className="flex gap-2 pt-1">
                                <button onClick={() => setEditingTask(null)}
                                  className="flex-1 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted">
                                  Cancel
                                </button>
                                <button
                                  disabled={!taskDraft.title.trim() || updatingTaskId === task.id}
                                  onClick={() => updateTask(task.id, {
                                    title: taskDraft.title,
                                    description: taskDraft.description || null,
                                    category: taskDraft.category || null,
                                    dueDate: taskDraft.dueDate || null,
                                    assigneeId: taskDraft.assigneeId || null,
                                    notes: taskDraft.notes || null,
                                  })}
                                  className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50">
                                  {updatingTaskId === task.id ? "Saving…" : "Save Task"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* View mode */
                            <>
                              {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
                              {task.completedBy && (
                                <p className="text-xs text-green-700 dark:text-green-400">
                                  ✓ Completed by {task.completedBy.name}
                                  {task.completedAt ? ` on ${format(new Date(task.completedAt), "MMM d, yyyy")}` : ""}
                                </p>
                              )}
                              {task.notes && (
                                <p className="text-xs italic text-muted-foreground bg-muted/60 rounded-lg px-3 py-2">
                                  💬 {task.notes}
                                </p>
                              )}

                              {/* Status buttons */}
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1.5">Update status:</p>
                                <div className="flex flex-wrap gap-2">
                                  {Object.entries(TASK_STATUS_CONFIG).map(([s, c]) => (
                                    <button key={s}
                                      disabled={updatingTaskId === task.id || task.status === s}
                                      onClick={() => updateTask(task.id, { status: s })}
                                      className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all disabled:opacity-40
                                        ${task.status === s ? c.color + " border-transparent shadow-sm" : "border-border hover:bg-muted"}`}>
                                      {c.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Edit / Delete */}
                              {canManage && (
                                <div className="flex items-center gap-3 pt-1 border-t border-border/50">
                                  <button onClick={() => startEditTask(task)}
                                    className="text-xs text-primary hover:underline flex items-center gap-1">
                                    <Edit2 className="w-3 h-3" /> Edit task
                                  </button>
                                  <button onClick={() => deleteTask(task.id)}
                                    className="text-xs text-red-600 hover:underline flex items-center gap-1">
                                    <Trash2 className="w-3 h-3" /> Delete
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Add task */}
          {canManage && workflow.status === "active" && (
            <div>
              {!addingTask ? (
                <button onClick={() => setAddingTask(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary transition-all">
                  <Plus className="w-4 h-4" /> Add custom task
                </button>
              ) : (
                <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/10">
                  <h4 className="font-semibold text-sm">New Task</h4>
                  <input value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                    placeholder="Task title *" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none" />
                  <textarea value={newTask.description} onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
                    placeholder="Description (optional)" rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none resize-none" />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={newTask.category} onChange={e => setNewTask(p => ({ ...p, category: e.target.value }))}
                      placeholder="Category" className="px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none" />
                    <input type="date" value={newTask.dueDate} onChange={e => setNewTask(p => ({ ...p, dueDate: e.target.value }))}
                      className="px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none" />
                  </div>
                  <select value={newTask.assigneeId} onChange={e => setNewTask(p => ({ ...p, assigneeId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none">
                    <option value="">Assign to… (optional)</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setAddingTask(false)} className="flex-1">Cancel</Button>
                    <Button size="sm" onClick={addTask} className="flex-1">Add Task</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>}

        {/* Documents */}
        {activeTab === "documents" && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Upload area */}
            <div className="border-2 border-dashed border-border rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Upload Document</span>
              </div>
              <input
                value={docNotes}
                onChange={e => setDocNotes(e.target.value)}
                placeholder="Notes (optional)"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none"
              />
              <label className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-colors ${uploading ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}>
                {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? "Uploading…" : "Choose Files"}
                <input type="file" className="hidden" disabled={uploading} onChange={handleFileUpload} multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.txt,.csv" />
              </label>
            </div>

            {/* Document list */}
            {docsLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin opacity-40" />
                <p className="text-sm">Loading…</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No documents uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.uploadedByName && `By ${doc.uploadedByName} · `}
                        {format(new Date(doc.createdAt), "MMM d, yyyy")}
                      </p>
                      {doc.notes && <p className="text-xs italic text-muted-foreground mt-0.5">{doc.notes}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => viewDoc(doc)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title="View">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => downloadDoc(doc)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title="Download">
                        <Download className="w-4 h-4" />
                      </button>
                      {canManage && (
                        <button onClick={() => deleteDoc(doc.id)}
                          className="p-1.5 rounded-lg hover:bg-red-100 hover:text-red-600 text-muted-foreground" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer actions */}
        {canManage && workflow.status === "active" && (
          <div className="border-t border-border px-4 py-3 flex gap-2">
            <button onClick={() => updateWorkflowMeta({ status: "completed" })}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors">
              <CheckCircle2 className="w-4 h-4" /> Complete Workflow
            </button>
            <button onClick={() => { if (confirm("Cancel this workflow?")) updateWorkflowMeta({ status: "cancelled" }); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors">
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        )}
      </div>

      {/* Document Viewer Modal */}
      {viewingDoc && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setViewingDoc(null)}>
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <span className="font-semibold text-sm truncate">{viewingDoc.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    const blob = new Blob([Uint8Array.from(atob(viewingDoc.fileData), c => c.charCodeAt(0))], { type: viewingDoc.fileType || "application/octet-stream" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a"); a.href = url; a.download = viewingDoc.name; a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium">
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
                <button onClick={() => setViewingDoc(null)} className="p-1.5 rounded-lg hover:bg-muted">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-auto bg-muted/20">
              {viewingDoc.fileType.startsWith("image/") ? (
                <img
                  src={`data:${viewingDoc.fileType};base64,${viewingDoc.fileData}`}
                  alt={viewingDoc.name}
                  className="max-w-full mx-auto block p-4"
                />
              ) : viewingDoc.fileType === "application/pdf" ? (
                <iframe
                  src={`data:application/pdf;base64,${viewingDoc.fileData}`}
                  className="w-full h-full min-h-[70vh] border-0"
                  title={viewingDoc.name}
                />
              ) : viewingDoc.fileType.startsWith("text/") ? (
                <pre className="p-5 text-xs whitespace-pre-wrap break-all font-mono text-foreground">
                  {atob(viewingDoc.fileData)}
                </pre>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
                  <FileText className="w-16 h-16 opacity-20" />
                  <p className="text-sm">Preview not available for this file type.</p>
                  <button
                    onClick={() => {
                      const blob = new Blob([Uint8Array.from(atob(viewingDoc.fileData), c => c.charCodeAt(0))], { type: viewingDoc.fileType || "application/octet-stream" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a"); a.href = url; a.download = viewingDoc.name; a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
                    <Download className="w-4 h-4" /> Download to open
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Templates Manager ────────────────────────────────────────────────────────

function TemplatesPanel({
  templates, users, onTemplatesChanged, onClose,
}: {
  templates: any[];
  users: any[];
  onTemplatesChanged: () => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", type: "onboarding" as "onboarding" | "offboarding", description: "", tasks: [] as any[] });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const resetForm = () => setForm({ name: "", type: "onboarding", description: "", tasks: [] });

  const startEdit = (tmpl: any) => {
    setEditingId(tmpl.id);
    setForm({ name: tmpl.name, type: tmpl.type, description: tmpl.description || "", tasks: tmpl.tasks || [] });
    setCreating(true);
  };

  const addTask = () => setForm(f => ({ ...f, tasks: [...f.tasks, { title: "", description: "", category: "", defaultAssigneeRole: "", dueInDays: "" }] }));
  const removeTask = (i: number) => setForm(f => ({ ...f, tasks: f.tasks.filter((_, idx) => idx !== i) }));
  const updateTask = (i: number, field: string, val: string) =>
    setForm(f => ({ ...f, tasks: f.tasks.map((t, idx) => idx === i ? { ...t, [field]: val } : t) }));

  const save = async () => {
    if (!form.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const body = {
        name: form.name, type: form.type, description: form.description,
        tasks: form.tasks.filter(t => t.title.trim()).map((t, i) => ({
          title: t.title, description: t.description, category: t.category,
          defaultAssigneeRole: t.defaultAssigneeRole, orderIndex: i,
          dueInDays: t.dueInDays ? parseInt(t.dueInDays) : null,
        })),
      };
      const url = editingId ? `/api/onboarding/templates/${editingId}` : "/api/onboarding/templates";
      const method = editingId ? "PUT" : "POST";
      const res = await apiFetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: editingId ? "Template updated" : "Template created" });
      onTemplatesChanged();
      setCreating(false); setEditingId(null); resetForm();
    } catch (err: any) {
      toast({ title: err.message || "Failed to save template", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const deleteTemplate = async (id: number) => {
    if (!confirm("Delete this template? Existing workflows won't be affected.")) return;
    try {
      await apiFetch(`/api/onboarding/templates/${id}`, { method: "DELETE" });
      toast({ title: "Template deleted" });
      onTemplatesChanged();
    } catch {
      toast({ title: "Failed to delete template", variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-background rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold flex items-center gap-2"><Settings className="w-5 h-5" /> Workflow Templates</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          {!creating ? (
            <>
              <Button onClick={() => { resetForm(); setEditingId(null); setCreating(true); }}>
                <Plus className="w-4 h-4 mr-2" /> New Template
              </Button>
              {templates.length === 0 && <p className="text-muted-foreground text-center py-8">No templates yet.</p>}
              {templates.map(tmpl => (
                <div key={tmpl.id} className="border border-border rounded-xl overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30"
                    onClick={() => setExpandedId(expandedId === tmpl.id ? null : tmpl.id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{tmpl.name}</span>
                        {tmpl.isDefault && <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">default</span>}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full capitalize ${tmpl.type === "onboarding" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>{tmpl.type}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{tmpl.tasks?.length ?? 0} tasks{tmpl.description ? ` · ${tmpl.description}` : ""}</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); startEdit(tmpl); }}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"><Edit2 className="w-4 h-4" /></button>
                    {!tmpl.isDefault && (
                      <button onClick={e => { e.stopPropagation(); deleteTemplate(tmpl.id); }}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    )}
                    {expandedId === tmpl.id ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  {expandedId === tmpl.id && (
                    <div className="border-t border-border px-4 py-3 bg-muted/10 space-y-1">
                      {(tmpl.tasks || []).map((t: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-sm py-1">
                          <span className="text-muted-foreground text-xs w-5 text-right">{i + 1}.</span>
                          <span className="flex-1">{t.title}</span>
                          {t.category && <span className={`text-xs px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[t.category] ?? "bg-gray-100 text-gray-600"}`}>{t.category}</span>}
                          {t.dueInDays != null && <span className="text-xs text-muted-foreground">Day {t.dueInDays}</span>}
                        </div>
                      ))}
                      {(!tmpl.tasks || tmpl.tasks.length === 0) && <p className="text-sm text-muted-foreground italic">No tasks defined.</p>}
                    </div>
                  )}
                </div>
              ))}
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{editingId ? "Edit Template" : "New Template"}</h3>
                <button onClick={() => { setCreating(false); setEditingId(null); resetForm(); }}
                  className="text-sm text-muted-foreground hover:text-foreground">Cancel</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Name *</Label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-border bg-background outline-none" />
                </div>
                {!editingId && (
                  <div>
                    <Label>Type</Label>
                    <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}
                      className="w-full mt-1 px-3 py-2 rounded-xl border border-border bg-background outline-none">
                      <option value="onboarding">Onboarding</option>
                      <option value="offboarding">Offboarding</option>
                    </select>
                  </div>
                )}
                <div className={editingId ? "col-span-2" : ""}>
                  <Label>Description</Label>
                  <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-border bg-background outline-none" />
                </div>
              </div>
              <div className="border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">Tasks ({form.tasks.length})</h4>
                  <Button size="sm" variant="outline" onClick={addTask}><Plus className="w-4 h-4 mr-1" />Add</Button>
                </div>
                {form.tasks.map((t, i) => (
                  <div key={i} className="bg-muted/40 rounded-xl p-3 space-y-2">
                    <div className="flex gap-2">
                      <input value={t.title} onChange={e => updateTask(i, "title", e.target.value)}
                        placeholder="Title *" className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-sm outline-none" />
                      <button onClick={() => removeTask(i)} className="p-1.5 rounded-lg hover:bg-red-100 hover:text-red-600 text-muted-foreground"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={t.category} onChange={e => updateTask(i, "category", e.target.value)}
                        placeholder="Category" className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm outline-none" />
                      <input type="number" value={t.dueInDays} onChange={e => updateTask(i, "dueInDays", e.target.value)}
                        placeholder="Due in N days" className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm outline-none" />
                    </div>
                  </div>
                ))}
                {form.tasks.length === 0 && <p className="text-sm text-muted-foreground italic text-center py-2">No tasks. Add tasks above.</p>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setCreating(false); setEditingId(null); resetForm(); }}>Cancel</Button>
                <Button className="flex-1" onClick={save} disabled={loading}>{loading ? "Saving..." : "Save Template"}</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"onboarding" | "offboarding">("onboarding");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<any | null>(null);

  const userCustomRoleName = (user as any)?.customRole?.name?.toLowerCase() ?? null;
  const canManage = user?.role === "super_admin" || user?.role === "admin"
    || userCustomRoleName === "hr manager";

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [wfRes, tmplRes, usersRes] = await Promise.all([
        apiFetch(`/api/onboarding/workflows`),
        apiFetch(`/api/onboarding/templates`),
        apiFetch(`/api/users`),
      ]);
      if (wfRes.ok) setWorkflows(await wfRes.json());
      if (tmplRes.ok) setTemplates(await tmplRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
    } catch {
      toast({ title: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleWorkflowUpdate = (updated: any) => {
    setWorkflows(prev => prev.map(w => w.id === updated.id ? updated : w));
    if (selectedWorkflow?.id === updated.id) setSelectedWorkflow(updated);
  };

  const filtered = workflows
    .filter(w => w.type === tab)
    .filter(w => statusFilter === "all" || w.status === statusFilter)
    .filter(w => !search || w.title.toLowerCase().includes(search.toLowerCase()) || w.employee?.name.toLowerCase().includes(search.toLowerCase()));

  const stats = {
    total: workflows.filter(w => w.type === tab).length,
    active: workflows.filter(w => w.type === tab && w.status === "active").length,
    completed: workflows.filter(w => w.type === tab && w.status === "completed").length,
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Onboarding & Offboarding"
        description="Manage HR workflows for new hires and departing staff"
        action={canManage ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowTemplates(true)}>
              <Settings className="w-4 h-4 mr-2" /> Templates
            </Button>
            <Button onClick={() => setShowStartDialog(true)}>
              <Plus className="w-4 h-4 mr-2" /> Start Workflow
            </Button>
          </div>
        ) : undefined}
      />

      {/* Tab + stats */}
      <div className="flex gap-3 mb-6">
        {(["onboarding", "offboarding"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${tab === t ? (t === "onboarding" ? "bg-blue-600 text-white shadow" : "bg-red-600 text-white shadow") : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            {t === "onboarding" ? <UserPlus className="w-4 h-4" /> : <UserMinus className="w-4 h-4" />}
            <span className="capitalize">{t}</span>
          </button>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Active", value: stats.active, color: "text-primary" },
          { label: "Completed", value: stats.completed, color: "text-green-600" },
        ].map(s => (
          <Card key={s.label} className="p-4 text-center">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by employee or title..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-4 py-2 rounded-xl border border-border bg-background text-sm outline-none">
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Workflow list */}
      {loading ? (
        <div className="flex justify-center py-20 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          {tab === "onboarding" ? <UserPlus className="w-16 h-16 mx-auto mb-4 opacity-20" /> : <UserMinus className="w-16 h-16 mx-auto mb-4 opacity-20" />}
          <p className="text-lg font-semibold text-muted-foreground mb-2">No {tab} workflows</p>
          {canManage && <Button onClick={() => setShowStartDialog(true)}><Plus className="w-4 h-4 mr-2" /> Start First Workflow</Button>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(wf => (
            <Card key={wf.id}
              className="p-5 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedWorkflow(wf)}>
              <div className="flex items-start gap-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tab === "onboarding" ? "bg-blue-100" : "bg-red-100"}`}>
                  {tab === "onboarding" ? <UserPlus className="w-5 h-5 text-blue-600" /> : <UserMinus className="w-5 h-5 text-red-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold truncate">{wf.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      wf.status === "completed" ? "bg-green-100 text-green-700"
                      : wf.status === "cancelled" ? "bg-gray-100 text-gray-600"
                      : "bg-primary/10 text-primary"}`}>
                      {wf.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{wf.employee?.name ?? "—"}</span>
                    <span>Started {format(new Date(wf.startDate), "MMM d, yyyy")}</span>
                    {wf.targetCompletionDate && (
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Due {format(new Date(wf.targetCompletionDate), "MMM d")}</span>
                    )}
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{wf.completedTasks}/{wf.totalTasks} tasks</span>
                      <span className="font-semibold text-primary">{wf.progress}%</span>
                    </div>
                    <ProgressBar value={wf.progress} />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Dialogs */}
      {showStartDialog && (
        <StartWorkflowDialog
          open={showStartDialog}
          onClose={() => setShowStartDialog(false)}
          templates={templates}
          users={users}
          onCreated={wf => { setWorkflows(prev => [wf, ...prev]); setSelectedWorkflow(wf); }}
        />
      )}

      {showTemplates && (
        <TemplatesPanel
          templates={templates}
          users={users}
          onTemplatesChanged={() => { loadData(); }}
          onClose={() => setShowTemplates(false)}
        />
      )}

      {selectedWorkflow && (
        <WorkflowDetail
          workflowInit={selectedWorkflow}
          users={users}
          canManage={canManage}
          onUpdate={handleWorkflowUpdate}
          onClose={() => setSelectedWorkflow(null)}
          onStartNew={canManage ? () => setShowStartDialog(true) : undefined}
        />
      )}
    </div>
  );
}
