import { useState, useEffect, useCallback } from "react";
import { PageHeader, Card, Button, Label } from "@/components/shared";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  UserPlus, UserMinus, CheckCircle2, Clock, AlertCircle, Plus, X,
  ChevronDown, ChevronRight, Edit2, Trash2, FileText, Users, Settings,
  RefreshCw, Search, Filter, Check, SkipForward, CircleDot,
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
  const { toast } = useToast();

  const filtered = templates.filter(t => t.type === type);

  useEffect(() => {
    if (!open) return;
    setType("onboarding"); setEmployeeId(""); setTemplateId("");
    setTitle(""); setNotes(""); setTargetDate(""); setCustomizeTasks(false); setTasks([]);
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
      const body: any = { employeeId, type, title, notes, targetCompletionDate: targetDate || undefined, templateId: templateId || undefined };
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
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
  workflow, users, canManage, onUpdate, onClose,
}: {
  workflow: any;
  users: any[];
  canManage: boolean;
  onUpdate: (wf: any) => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [addingTask, setAddingTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", description: "", category: "", assigneeId: "", dueDate: "" });
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);
  const [expandedTask, setExpandedTask] = useState<number | null>(null);

  const updateTask = async (taskId: number, patch: any) => {
    setUpdatingTaskId(taskId);
    try {
      const res = await apiFetch(`/api/onboarding/tasks/${taskId}`, {
        method: "PATCH", body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onUpdate(await res.json());
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
      onUpdate(await res.json());
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
      onUpdate(await res.json());
      setNewTask({ title: "", description: "", category: "", assigneeId: "", dueDate: "" });
      setAddingTask(false);
      toast({ title: "Task added" });
    } catch (err: any) {
      toast({ title: err.message || "Failed to add task", variant: "destructive" });
    }
  };

  const updateWorkflowStatus = async (status: string) => {
    try {
      const res = await apiFetch(`/api/onboarding/workflows/${workflow.id}`, {
        method: "PUT", body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      onUpdate(await res.json());
      toast({ title: `Workflow marked as ${status}` });
    } catch {
      toast({ title: "Failed to update workflow status", variant: "destructive" });
    }
  };

  const groupedTasks: Record<string, any[]> = {};
  (workflow.tasks || []).forEach((t: any) => {
    const cat = t.category || "General";
    if (!groupedTasks[cat]) groupedTasks[cat] = [];
    groupedTasks[cat].push(t);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/30 backdrop-blur-sm">
      <div className="bg-background h-full w-full max-w-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-4 border-b border-border ${workflow.type === "onboarding" ? "bg-blue-50" : "bg-red-50"}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
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
              <h2 className="text-lg font-bold truncate">{workflow.title}</h2>
              <p className="text-sm text-muted-foreground">{workflow.employee?.name} · Started by {workflow.startedBy?.name}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted shrink-0"><X className="w-5 h-5" /></button>
          </div>

          {/* Progress */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">{workflow.completedTasks}/{workflow.totalTasks} tasks done</span>
              <span className="text-xs font-bold text-primary">{workflow.progress}%</span>
            </div>
            <ProgressBar value={workflow.progress} />
          </div>

          {workflow.targetCompletionDate && (
            <p className="text-xs text-muted-foreground mt-2">
              Target: {format(new Date(workflow.targetCompletionDate), "MMM d, yyyy")}
            </p>
          )}
        </div>

        {/* Tasks */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {Object.keys(groupedTasks).length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No tasks in this workflow.</p>
            </div>
          )}
          {Object.entries(groupedTasks).map(([category, catTasks]) => (
            <div key={category}>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">{category}</h4>
              <div className="space-y-2">
                {catTasks.map((task: any) => {
                  const cfg = TASK_STATUS_CONFIG[task.status as keyof typeof TASK_STATUS_CONFIG] ?? TASK_STATUS_CONFIG.pending;
                  const Icon = cfg.icon;
                  const isExpanded = expandedTask === task.id;
                  return (
                    <div key={task.id} className="border border-border rounded-xl bg-background overflow-hidden">
                      <div
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30"
                        onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${task.status === "completed" ? "text-green-600" : task.status === "in_progress" ? "text-blue-600" : "text-muted-foreground"}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {task.assignee && <span className="text-xs text-muted-foreground">→ {task.assignee.name}</span>}
                            {task.dueDate && <span className="text-xs text-muted-foreground">{format(new Date(task.dueDate), "MMM d")}</span>}
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${cfg.color}`}>{cfg.label}</span>
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                      </div>

                      {isExpanded && (
                        <div className="border-t border-border px-4 py-3 space-y-3 bg-muted/20">
                          {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
                          {task.completedBy && (
                            <p className="text-xs text-green-700">Completed by {task.completedBy.name}{task.completedAt ? ` on ${format(new Date(task.completedAt), "MMM d, yyyy")}` : ""}</p>
                          )}
                          {task.notes && <p className="text-xs italic text-muted-foreground">Note: {task.notes}</p>}

                          {/* Status controls */}
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(TASK_STATUS_CONFIG).map(([s, c]) => (
                              <button key={s} disabled={updatingTaskId === task.id || task.status === s}
                                onClick={() => updateTask(task.id, { status: s })}
                                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all disabled:opacity-40 ${task.status === s ? c.color + " border-transparent" : "border-border hover:bg-muted"}`}>
                                {c.label}
                              </button>
                            ))}
                          </div>

                          {/* Assignee */}
                          {canManage && (
                            <select
                              defaultValue={task.assigneeId ?? ""}
                              onChange={e => updateTask(task.id, { assigneeId: e.target.value || null })}
                              className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background outline-none"
                            >
                              <option value="">Unassigned</option>
                              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                          )}

                          {canManage && (
                            <div className="flex gap-2">
                              <button onClick={() => deleteTask(task.id)}
                                className="text-xs text-red-600 hover:underline flex items-center gap-1">
                                <Trash2 className="w-3 h-3" /> Delete task
                              </button>
                            </div>
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
                <div className="border border-border rounded-xl p-4 space-y-3">
                  <h4 className="font-semibold text-sm">New Task</h4>
                  <input value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                    placeholder="Task title *" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none" />
                  <input value={newTask.description} onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
                    placeholder="Description (optional)" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none" />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={newTask.category} onChange={e => setNewTask(p => ({ ...p, category: e.target.value }))}
                      placeholder="Category" className="px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none" />
                    <input type="date" value={newTask.dueDate} onChange={e => setNewTask(p => ({ ...p, dueDate: e.target.value }))}
                      className="px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none" />
                  </div>
                  <select value={newTask.assigneeId} onChange={e => setNewTask(p => ({ ...p, assigneeId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none">
                    <option value="">Assign to... (optional)</option>
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
        </div>

        {/* Footer actions */}
        {canManage && workflow.status === "active" && (
          <div className="border-t border-border px-4 py-3 flex gap-2">
            <button onClick={() => updateWorkflowStatus("completed")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700">
              <CheckCircle2 className="w-4 h-4" /> Complete Workflow
            </button>
            <button onClick={() => { if (confirm("Cancel this workflow?")) updateWorkflowStatus("cancelled"); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-muted">
              <X className="w-4 h-4" /> Cancel Workflow
            </button>
          </div>
        )}
      </div>
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
          workflow={selectedWorkflow}
          users={users}
          canManage={canManage}
          onUpdate={handleWorkflowUpdate}
          onClose={() => setSelectedWorkflow(null)}
        />
      )}
    </div>
  );
}
