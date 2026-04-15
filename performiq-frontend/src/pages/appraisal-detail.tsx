import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useGetAppraisal, useUpdateAppraisal } from "../lib";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader, Card, StatusBadge, Button, Label } from "@/components/shared";
import { useAuth } from "@/hooks/use-auth";
import { CheckCircle2, User, Star, FileText, ShieldCheck, ThumbsUp, ArrowRight, Users, MessageSquare, ArrowLeft, RotateCcw, Target, Pencil, Trash2, Plus, X } from "lucide-react";
import { format } from "date-fns";
import { apiFetch } from "@/lib/utils";

const WORKFLOW_ROUTES: Record<string, { label: string; steps: string[] }> = {
  self_only:       { label: "Self Only",              steps: ["Self Review", "Completed"] },
  manager_review:  { label: "Employee → Manager",     steps: ["Self Review", "Manager Review", "Completed"] },
  admin_approval:  { label: "Full Approval",          steps: ["Self Review", "Manager Review", "Admin Approval", "Completed"] },
};

export default function AppraisalDetail() {
  const [, params] = useRoute("/appraisals/:id");
  const [, navigate] = useLocation();
  const appraisalId = params?.id ? parseInt(params.id) : 0;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };

  const { data: appraisal, isLoading } = useGetAppraisal(appraisalId, {
    request: { headers },
    query: { enabled: !!appraisalId } as any
  });

  const updateMutation = useUpdateAppraisal({ request: { headers } });

  const [scores, setScores] = useState<Record<number, { score: number, note: string, actualValue?: number }>>({});
  const [generalComment, setGeneralComment] = useState("");
  const [adminActualValues, setAdminActualValues] = useState<Record<number, string>>({});
  const [savingAdminActuals, setSavingAdminActuals] = useState(false);
  const [showAdminActuals, setShowAdminActuals] = useState(false);
  const [formInitialized, setFormInitialized] = useState(false);
  const [declinedCriteria, setDeclinedCriteria] = useState<Set<number>>(new Set());
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [editBudgets, setEditBudgets] = useState<Record<number, string>>({});
  const [editingReviewer, setEditingReviewer] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [newReviewerId, setNewReviewerId] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (appraisal && !formInitialized) {
      const initialScores: Record<number, { score: number, note: string, actualValue?: number }> = {};
      const isSelf = appraisal.status === 'self_review';
      const reviewersList: any[] = (appraisal as any).reviewers ?? [];
      const activeRev = reviewersList.find((r: any) => r.stepStatus === 'in_progress');
      const reviewerScoresData: any[] = (appraisal as any).reviewerScores ?? [];
      const myReviewerEntry = activeRev ? reviewerScoresData.find((rs: any) => rs.reviewerId === activeRev.id) : null;
      const myReviewerScores: any[] = myReviewerEntry?.scores ?? [];

      appraisal.scores.forEach(s => {
        if (isSelf) {
          initialScores[s.criterionId] = {
            score: Number(s.selfScore ?? 3) || 3,
            note: s.selfNote || "",
            actualValue: s.actualValue ? Number(s.actualValue) : undefined,
          };
        } else {
          const myRevScore = myReviewerScores.find((rs: any) => rs.criterionId === s.criterionId);
          initialScores[s.criterionId] = {
            score: myRevScore ? Number(myRevScore.score ?? 3) || 3 : 3,
            note: myRevScore?.note || "",
            actualValue: s.actualValue ? Number(s.actualValue) : undefined,
          };
        }
      });
      setScores(initialScores);
      const myRevComment = !isSelf && myReviewerEntry ? (myReviewerEntry.comment || "") : "";
      setGeneralComment(isSelf ? (appraisal.selfComment || "") : myRevComment);
      setFormInitialized(true);
    }
  }, [appraisal, formInitialized]);

  if (isLoading || !appraisal) return <div className="p-8 animate-pulse text-muted-foreground">Loading details...</div>;

  const reviewers: any[] = (appraisal as any).reviewers ?? (appraisal.reviewer ? [appraisal.reviewer] : []);
  const activeReviewer = reviewers.find((r: any) => r.stepStatus === 'in_progress') ?? null;
  const isCurrentInProgressReviewer = activeReviewer?.id === user?.id;
  const isSelfReviewActive = appraisal.status === 'self_review' && user?.id === appraisal.employeeId;
  const isManagerReviewActive = appraisal.status === 'manager_review' && (isCurrentInProgressReviewer || user?.role === 'admin' || user?.role === 'super_admin');
  const isPendingAdminApproval = appraisal.status === 'pending_approval' && (user?.role === 'admin' || user?.role === 'super_admin');
  const canEdit = isSelfReviewActive || isManagerReviewActive;

  const handleScoreChange = (criterionId: number, field: 'score' | 'note' | 'actualValue', value: any) => {
    setScores(prev => ({
      ...prev,
      [criterionId]: { ...prev[criterionId], [field]: value }
    }));
  };

  const handleActualValueChange = (criterionId: number, actualVal: number, targetVal: number, budgetVal?: number) => {
    const effectiveTarget = budgetVal && budgetVal > 0 ? budgetVal : targetVal;
    const computed = effectiveTarget > 0 ? Math.min(5, (actualVal / effectiveTarget) * 5) : 0;
    setScores(prev => ({
      ...prev,
      [criterionId]: { ...prev[criterionId], actualValue: actualVal, score: Math.round(computed * 10) / 10 }
    }));
  };

  const handleSaveAdminActuals = async () => {
    setSavingAdminActuals(true);
    const vals: Record<number, number> = {};
    for (const [k, v] of Object.entries(adminActualValues)) {
      if (v && Number(v) > 0) vals[Number(k)] = Number(v);
    }
    try {
      await apiFetch(`/api/appraisals/${appraisalId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_actuals", adminActualValues: vals }),
      });
      queryClient.invalidateQueries({ queryKey: [`/api/appraisals/${appraisalId}`] });
      setShowAdminActuals(false);
    } catch {}
    setSavingAdminActuals(false);
  };

  const handleAcceptValue = async (appraisalId: number, criterionId: number, accepted: "admin" | "employee") => {
    try {
      await apiFetch(`/api/appraisals/${appraisalId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept_value", criterionId, accepted }),
      });
      queryClient.invalidateQueries({ queryKey: [`/api/appraisals/${appraisalId}`] });
    } catch {}
  };

  const handleSubmit = (action: 'save' | 'submit') => {
    const scoresArray = Object.entries(scores).map(([critId, data]) => {
      const base = { criterionId: parseInt(critId), actualValue: data.actualValue ?? null };
      if (isSelfReviewActive) return { ...base, selfScore: data.score, selfNote: data.note };
      return { ...base, managerScore: data.score, managerNote: data.note };
    });

    const payload: any = { action, scores: scoresArray };
    if (isSelfReviewActive) payload.selfComment = generalComment;
    else payload.managerComment = generalComment;

    updateMutation.mutate(
      { id: appraisalId, data: payload },
      {
        onSuccess: () => {
          setFormInitialized(false);
          queryClient.invalidateQueries({ queryKey: [`/api/appraisals/${appraisalId}`] });
        }
      }
    );
  };

  // Compute a contextual notice for the current viewer
  const statusNotice = (() => {
    if (appraisal.status === 'self_review') {
      if (user?.id === appraisal.employeeId)
        return { color: 'amber', text: 'Your turn — fill in your self-evaluation below and click Submit Review when done.' };
      return { color: 'blue', text: `Waiting for ${appraisal.employee?.name ?? 'the employee'} to complete their self-evaluation.` };
    }
    if (appraisal.status === 'manager_review') {
      if (isManagerReviewActive)
        return { color: 'blue', text: `Your turn — review ${appraisal.employee?.name ?? 'the employee'}'s self-evaluation and fill in your manager scores below.` };
      const activeName = activeReviewer?.name ?? 'the reviewer';
      const completedCount = reviewers.filter((r: any) => r.stepStatus === 'completed').length;
      const stepInfo = reviewers.length > 1 ? ` (step ${completedCount + 1} of ${reviewers.length})` : '';
      return { color: 'blue', text: `Waiting for ${activeName}${stepInfo} to complete their review.` };
    }
    if (appraisal.status === 'pending_approval')
      return { color: 'purple', text: 'Waiting for admin approval. Review the scores below and click Approve & Complete.' };
    if (appraisal.status === 'completed')
      return { color: 'green', text: 'This appraisal has been completed.' };
    return null;
  })();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-4">
        <button
          onClick={() => navigate("/appraisals")}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Appraisals
        </button>
      </div>
      <PageHeader title="Appraisal Detail" />

      {/* Status Notice Banner */}
      {statusNotice && (
        <div className={`mb-6 px-5 py-4 rounded-2xl border text-sm font-medium flex items-start gap-3
          ${statusNotice.color === 'amber'  ? 'bg-amber-50 border-amber-200 text-amber-800'  :
            statusNotice.color === 'blue'   ? 'bg-blue-50  border-blue-200  text-blue-800'   :
            statusNotice.color === 'purple' ? 'bg-purple-50 border-purple-200 text-purple-800':
                                              'bg-green-50  border-green-200 text-green-800'  }`}>
          <span className="mt-0.5 text-lg leading-none">
            {statusNotice.color === 'amber' ? '✏️' : statusNotice.color === 'blue' ? '⏳' : statusNotice.color === 'purple' ? '🔎' : '✅'}
          </span>
          {statusNotice.text}
        </div>
      )}

      {/* Header Info Card */}
      <Card className="p-6 mb-8 bg-gradient-to-br from-card to-muted/30">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold shadow-md">
              {(appraisal.employee?.name ?? appraisal.employee?.email ?? "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-2xl font-bold">{appraisal.employee?.name ?? appraisal.employee?.email}</h2>
              <p className="text-muted-foreground">{appraisal.employee?.jobTitle || 'Employee'} • {appraisal.employee?.department}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 items-start md:items-end bg-background p-4 rounded-xl border border-border shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Cycle:</span>
              <span className="font-semibold">{appraisal.cycle.name}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-1 mt-1 shrink-0">
                <Users className="w-3.5 h-3.5" /> Review Chain:
              </span>
              <div className="flex flex-wrap gap-1 justify-end">
                {reviewers.length > 0 ? reviewers.map((r: any, i: number) => {
                  const isDone = r.stepStatus === 'completed';
                  const isActive = r.stepStatus === 'in_progress';
                  const isPending = r.stepStatus === 'pending';
                  return (
                    <span key={r.id} className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border
                      ${isDone ? 'bg-green-100 text-green-700 border-green-200' :
                        isActive ? 'bg-blue-100 text-blue-700 border-blue-300 ring-1 ring-blue-300' :
                                   'bg-muted text-muted-foreground border-border'}`}>
                      <span className="opacity-60 font-normal">{i + 1}.</span> {r.name}
                      {isDone && <span>✓</span>}
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                    </span>
                  );
                }) : (
                  <span className="text-sm text-muted-foreground">Unassigned</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Status:</span>
              <StatusBadge status={appraisal.status} type="appraisal" />
            </div>
            {appraisal.workflowType && (() => {
              const wf = WORKFLOW_ROUTES[(appraisal as any).workflowType] ?? WORKFLOW_ROUTES.admin_approval;
              return (
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  <span className="text-xs text-muted-foreground mr-1">Route:</span>
                  {wf.steps.map((step, i) => (
                    <span key={step} className="flex items-center gap-1">
                      <span className="text-xs font-medium text-muted-foreground">{step}</span>
                      {i < wf.steps.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground/50" />}
                    </span>
                  ))}
                </div>
              );
            })()}
            {appraisal.overallScore !== null && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-medium text-muted-foreground">Final Score:</span>
                <span className="text-xl font-bold text-primary flex items-center gap-1">
                  {Number(appraisal.overallScore).toFixed(1)} <Star className="w-5 h-5 fill-primary text-primary" />
                </span>
                <span className="text-sm font-semibold text-muted-foreground">({(Number(appraisal.overallScore) / 5 * 100).toFixed(0)}%)</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Edit Appraisal — admin/manager can edit when employee hasn't submitted */}
      {(user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'manager') &&
        appraisal.status === 'self_review' && (
        <div className="mb-6">
          {!showEditPanel ? (
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  const init: Record<number, string> = {};
                  appraisal.scores.forEach(s => {
                    const bv = Number(s.budgetValue ?? (s as Record<string, unknown>).budget_value ?? 0);
                    if (bv > 0) init[s.criterionId] = String(bv);
                  });
                  setEditBudgets(init);
                  setShowEditPanel(true);
                }}
              >
                <Pencil className="w-4 h-4" /> Edit Appraisal
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={async () => {
                  if (!confirm("Delete this appraisal? This cannot be undone.")) return;
                  await apiFetch(`/api/appraisals/${appraisalId}`, { method: "DELETE" });
                  navigate("/appraisals");
                }}
              >
                <Trash2 className="w-4 h-4" /> Delete
              </Button>
            </div>
          ) : (
            <Card className="p-6 border-primary/30 bg-primary/5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Pencil className="w-5 h-5 text-primary" /> Edit Appraisal
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setShowEditPanel(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {(() => {
                const valueCriteria = appraisal.scores.filter(s => {
                  const t = s.criterion?.type ?? "rating";
                  return t === "value" || t === "percentage";
                });
                return valueCriteria.length > 0 ? (
                  <div className="mb-5">
                    <h4 className="text-sm font-semibold mb-2">Budget Values</h4>
                    <div className="space-y-2">
                      {valueCriteria.map(s => {
                        const crit = s.criterion;
                        return (
                          <div key={s.criterionId} className="flex items-center gap-3">
                            <span className="text-sm flex-1 min-w-0 truncate">{crit?.name}</span>
                            <input
                              type="number" min="0" step="0.01"
                              className="w-44 px-3 py-2 rounded-lg border border-border text-sm outline-none focus:ring-2 focus:ring-primary/20"
                              placeholder="Budget value"
                              value={editBudgets[s.criterionId] ?? ""}
                              onChange={e => setEditBudgets(prev => ({ ...prev, [s.criterionId]: e.target.value }))}
                            />
                            {crit?.unit && <span className="text-xs text-muted-foreground shrink-0">{crit.unit}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null;
              })()}

              <div className="mb-5">
                <h4 className="text-sm font-semibold mb-2">Reviewers</h4>
                <div className="space-y-2">
                  {reviewers.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between py-2 px-3 bg-white/60 rounded-lg border border-border">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{r.name}</span>
                        <span className="text-xs text-muted-foreground">({r.email})</span>
                      </div>
                      {user?.role === 'admin' || user?.role === 'super_admin' ? (
                        <button
                          type="button"
                          className="text-xs text-destructive hover:underline"
                          onClick={async () => {
                            if (!confirm(`Remove ${r.name} as reviewer?`)) return;
                            await apiFetch(`/api/appraisals/${appraisalId}/reviewers/${r.id}`, { method: "DELETE" });
                            queryClient.invalidateQueries({ queryKey: [`/api/appraisals/${appraisalId}`] });
                            setFormInitialized(false);
                          }}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {reviewers.length === 0 && (
                    <p className="text-sm text-muted-foreground">No reviewers assigned.</p>
                  )}
                  {(user?.role === 'admin' || user?.role === 'super_admin') && (
                    <div>
                      {!editingReviewer ? (
                        <Button variant="outline" size="sm" className="gap-2 mt-1" onClick={async () => {
                          const resp = await apiFetch("/api/users");
                          const users = await resp.json();
                          setAvailableUsers(Array.isArray(users) ? users.filter((u: any) => u.role === 'manager' || u.role === 'admin' || u.role === 'super_admin') : []);
                          setEditingReviewer(true);
                        }}>
                          <Plus className="w-4 h-4" /> Add Reviewer
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2 mt-1">
                          <select
                            className="flex-1 px-3 py-2 rounded-lg border border-border text-sm"
                            value={newReviewerId}
                            onChange={e => setNewReviewerId(e.target.value)}
                          >
                            <option value="">Select reviewer...</option>
                            {availableUsers
                              .filter(u => !reviewers.some((r: any) => r.id === u.id) && u.id !== appraisal.employeeId)
                              .map(u => (
                                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                              ))}
                          </select>
                          <Button size="sm" disabled={!newReviewerId} onClick={async () => {
                            await apiFetch(`/api/appraisals/${appraisalId}/reviewers`, {
                              method: "POST",
                              body: JSON.stringify({ reviewerId: Number(newReviewerId) }),
                            });
                            setNewReviewerId("");
                            setEditingReviewer(false);
                            setFormInitialized(false);
                            queryClient.invalidateQueries({ queryKey: [`/api/appraisals/${appraisalId}`] });
                          }}>
                            Add
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setEditingReviewer(false); setNewReviewerId(""); }}>
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={async () => {
                    if (!confirm("Delete this appraisal? This cannot be undone.")) return;
                    await apiFetch(`/api/appraisals/${appraisalId}`, { method: "DELETE" });
                    navigate("/appraisals");
                  }}
                >
                  <Trash2 className="w-4 h-4" /> Delete Appraisal
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowEditPanel(false)}>Cancel</Button>
                  <Button
                    size="sm"
                    className="gap-2"
                    isLoading={savingEdit}
                    onClick={async () => {
                      setSavingEdit(true);
                      try {
                        const budgetValues: Record<number, number> = {};
                        for (const [k, v] of Object.entries(editBudgets)) {
                          if (v && Number(v) > 0) budgetValues[Number(k)] = Number(v);
                        }
                        if (Object.keys(budgetValues).length > 0) {
                          await apiFetch(`/api/appraisals/${appraisalId}`, {
                            method: "PUT",
                            body: JSON.stringify({ action: "update_budgets", budgetValues }),
                          });
                        }
                        setFormInitialized(false);
                        queryClient.invalidateQueries({ queryKey: [`/api/appraisals/${appraisalId}`] });
                        setShowEditPanel(false);
                      } catch {}
                      setSavingEdit(false);
                    }}
                  >
                    <CheckCircle2 className="w-4 h-4" /> Save Changes
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Accept All Back-Office Values — employee self-review shortcut */}
      {isSelfReviewActive && (() => {
        const valueScorez = appraisal.scores.filter(s => {
          const t = s.criterion?.type ?? "rating";
          return (t === "value" || t === "percentage");
        });
        const withAdmin = valueScorez.filter(s => {
          const av = Number(s.adminActualValue ?? (s as Record<string, unknown>).admin_actual_value ?? 0);
          return av > 0;
        });
        if (withAdmin.length === 0) return null;
        const allAccepted = withAdmin.every(s => {
          const av = Number(s.adminActualValue ?? (s as Record<string, unknown>).admin_actual_value ?? 0);
          const ev = scores[s.criterionId]?.actualValue;
          return ev === av && !declinedCriteria.has(s.criterionId);
        });
        return (
          <Card className="p-5 mb-6 border-green-200 bg-green-50/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-green-600 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-green-800">
                    {allAccepted ? "All Budget Target Values Accepted" : "Budget Target Values From Back-Office"}
                  </h3>
                  <p className="text-xs text-green-700 mt-0.5">
                    {allAccepted
                      ? "You've accepted all back-office figures. Complete your rating and comments below, then submit your review."
                      : `${withAdmin.length} budget target value${withAdmin.length > 1 ? "s have" : " has"} been set by back-office. Accept or decline each one below.`}
                  </p>
                </div>
              </div>
              {!allAccepted && (
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white gap-2 shrink-0"
                  onClick={() => {
                    setDeclinedCriteria(new Set());
                    withAdmin.forEach(s => {
                      const av = Number(s.adminActualValue ?? (s as Record<string, unknown>).admin_actual_value ?? 0);
                      const crit = s.criterion;
                      const target = Number(crit?.targetValue ?? 0);
                      const bv = Number(s.budgetValue ?? (s as Record<string, unknown>).budget_value ?? 0);
                      handleActualValueChange(s.criterionId, av, target, bv);
                    });
                  }}
                >
                  <CheckCircle2 className="w-4 h-4" /> Accept All
                </Button>
              )}
            </div>
          </Card>
        );
      })()}

      {/* Criteria Scoring */}
      <div className="space-y-6 mb-8">
        <h3 className="text-xl font-bold border-b border-border pb-2">Competencies & Criteria</h3>
        
        {appraisal.scores.map((scoreItem) => {
          const crit = scoreItem.criterion;
          const myVal = scores[crit.id] || { score: 3, note: "" };

          return (
            <Card key={crit.id} className="p-6 overflow-visible">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded">{crit.category}</span>
                    <span className="text-xs font-medium text-muted-foreground">Weight: {crit.weight}%</span>
                    {crit.type && crit.type !== "rating" && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded capitalize ${crit.type === "percentage" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                        Budget Target Value: {Number(crit.targetValue ?? (crit as any).target_value ?? 0).toLocaleString()}{crit.unit ? ` ${crit.unit}` : ""}
                      </span>
                    )}
                  </div>
                  <h4 className="text-lg font-semibold">{crit.name}</h4>
                  <p className="text-muted-foreground text-sm mt-1">{crit.description}</p>
                </div>
              </div>

              {/* Helper: render score input based on type */}
              {(() => {
                const critType: string = crit.type ?? "rating";
                const target = Number(crit.targetValue ?? (crit as any).target_value ?? 0);
                const unit: string = crit.unit ?? "";
                const budget = Number(scoreItem.budgetValue ?? (scoreItem as any).budget_value ?? 0);
                const effectiveTarget = budget > 0 ? budget : target;
                const periodLabel = (crit.targetPeriod ?? (crit as any).target_period) ? ((crit.targetPeriod ?? (crit as any).target_period) as string).replace('_', ' ') : null;

                const renderScoreInput = (color: string, isActive: boolean, isSelf: boolean) => {
                  if (!isActive) return null;
                  if (critType === "percentage" || critType === "value") {
                    const adminVal = Number(scoreItem.adminActualValue ?? (scoreItem as Record<string, unknown>).admin_actual_value ?? 0);
                    const empVal = myVal.actualValue;
                    const accepted: string | null = (scoreItem.acceptedValue ?? (scoreItem as Record<string, unknown>).accepted_value ?? null) as string | null;
                    const hasDispute = adminVal > 0 && empVal != null && empVal > 0 && Math.abs(adminVal - empVal) > 0.01;

                    const displayVal = accepted === "employee" ? empVal : accepted === "admin" ? adminVal : (empVal ?? adminVal);
                    const achievementRatio = effectiveTarget > 0 && displayVal ? (displayVal / effectiveTarget) : null;
                    const computedPct = achievementRatio != null ? Math.min(100, achievementRatio * 100) : null;
                    const weightedScore = achievementRatio != null ? achievementRatio * (Number(crit.weight) / 100) * 100 : null;

                    return (
                      <div className="space-y-3">
                        {budget > 0 && (
                          <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                            <Target className="w-4 h-4 text-emerald-600 shrink-0" />
                            <div className="text-sm">
                              <span className="font-semibold text-emerald-700">Budget Target Achieved: {effectiveTarget.toLocaleString()}{unit ? ` ${unit}` : ""}</span>
                              {periodLabel && <span className="text-emerald-600 ml-1 text-xs">({periodLabel})</span>}
                            </div>
                          </div>
                        )}


                        {isSelf && adminVal > 0 && (() => {
                          const isDeclined = declinedCriteria.has(crit.id);
                          const isAccepted = empVal === adminVal && !isDeclined;

                          return (
                            <div className="space-y-3">
                              {!isAccepted && !isDeclined && (
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                  <p className="text-sm text-slate-700 mb-3">Do you confirm the budget target achieved value of <span className="font-bold">{adminVal.toLocaleString()}{unit ? ` ${unit}` : ""}</span> is correct?</p>
                                  <div className="flex gap-3">
                                    <Button
                                      size="sm"
                                      className="bg-green-600 hover:bg-green-700 text-white gap-2"
                                      onClick={() => {
                                        setDeclinedCriteria(prev => { const n = new Set(prev); n.delete(crit.id); return n; });
                                        handleActualValueChange(crit.id, adminVal, target, budget);
                                      }}
                                    >
                                      <CheckCircle2 className="w-4 h-4" /> Accept
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-red-300 text-red-700 hover:bg-red-50 gap-2"
                                      onClick={() => setDeclinedCriteria(prev => new Set(prev).add(crit.id))}
                                    >
                                      Decline
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {isAccepted && (
                                <div className="p-3 bg-green-50 border border-green-300 rounded-lg">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                    <span className="text-sm font-semibold text-green-700">Accepted — {adminVal.toLocaleString()}{unit ? ` ${unit}` : ""}</span>
                                  </div>
                                  <button
                                    type="button"
                                    className="text-xs text-slate-500 underline mt-1 ml-6"
                                    onClick={() => {
                                      setDeclinedCriteria(prev => { const n = new Set(prev); n.delete(crit.id); return n; });
                                      handleScoreChange(crit.id, 'actualValue', undefined);
                                    }}
                                  >
                                    Change my mind
                                  </button>
                                </div>
                              )}

                              {isDeclined && (
                                <div>
                                  <Label>Enter your actual value{unit ? ` (${unit})` : ""}</Label>
                                  <div className="flex items-center gap-2 mt-1">
                                    <input
                                      type="number" min="0" step="0.01"
                                      value={empVal ?? ""}
                                      onChange={e => handleActualValueChange(crit.id, parseFloat(e.target.value) || 0, target, budget)}
                                      className="flex-1 px-3 py-2 rounded-lg border border-amber-400 bg-amber-50/50 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                                      placeholder={`Back-office: ${adminVal.toLocaleString()}`}
                                    />
                                    {unit && <span className="text-sm text-muted-foreground font-medium shrink-0">{unit}</span>}
                                  </div>
                                  <p className="text-xs text-amber-600 mt-1 font-medium">
                                    Your value will be compared with the back-office figure by the reviewer.
                                  </p>
                                  <button
                                    type="button"
                                    className="text-xs text-blue-600 underline mt-1"
                                    onClick={() => {
                                      setDeclinedCriteria(prev => { const n = new Set(prev); n.delete(crit.id); return n; });
                                      handleActualValueChange(crit.id, adminVal, target, budget);
                                    }}
                                  >
                                    Accept back-office value instead
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {isSelf && adminVal === 0 && (
                          <div>
                            <Label>
                              {critType === "percentage" ? `Actual %${unit ? ` (${unit})` : ""}` : `Actual Value${unit ? ` (${unit})` : ""}`}
                            </Label>
                            <div className="flex items-center gap-2 mt-1">
                              <input
                                type="number" min="0" step="0.01"
                                value={empVal ?? ""}
                                onChange={e => handleActualValueChange(crit.id, parseFloat(e.target.value) || 0, target, budget)}
                                className="flex-1 px-3 py-2 rounded-lg border border-border text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                placeholder={`Target: ${effectiveTarget.toLocaleString()}${unit ? ` ${unit}` : ""}`}
                              />
                              {unit && <span className="text-sm text-muted-foreground font-medium shrink-0">{unit}</span>}
                            </div>
                          </div>
                        )}

                        {!isSelf && !isActive && adminVal > 0 && empVal != null && empVal > 0 && (
                          <div className="text-sm text-muted-foreground">
                            Employee reported: <span className="font-semibold">{empVal.toLocaleString()}{unit ? ` ${unit}` : ""}</span>
                          </div>
                        )}

                        {hasDispute && !isSelf && isActive && (
                          <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg space-y-2">
                            <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                              <span className="text-base">&#9888;</span> Value Dispute
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <button
                                type="button"
                                onClick={() => handleAcceptValue(appraisalId, crit.id, "admin")}
                                className={`p-2.5 rounded-lg border text-sm text-left transition-colors ${accepted === "admin" ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200" : "border-border hover:bg-blue-50/50"}`}
                              >
                                <p className="font-semibold text-blue-700">Back-Office</p>
                                <p className="font-bold">{adminVal.toLocaleString()}{unit ? ` ${unit}` : ""}</p>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAcceptValue(appraisalId, crit.id, "employee")}
                                className={`p-2.5 rounded-lg border text-sm text-left transition-colors ${accepted === "employee" ? "border-amber-500 bg-amber-50 ring-2 ring-amber-200" : "border-border hover:bg-amber-50/50"}`}
                              >
                                <p className="font-semibold text-amber-700">Employee Counter</p>
                                <p className="font-bold">{empVal!.toLocaleString()}{unit ? ` ${unit}` : ""}</p>
                              </button>
                            </div>
                            {accepted && (
                              <p className="text-xs text-green-700 font-medium">Accepted: {accepted === "admin" ? "Back-Office" : "Employee"} value</p>
                            )}
                          </div>
                        )}

                        {displayVal != null && displayVal > 0 && effectiveTarget > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 bg-muted rounded-full h-2.5">
                                <div
                                  className={`h-2.5 rounded-full transition-all ${(computedPct ?? 0) >= 100 ? 'bg-green-500' : (computedPct ?? 0) >= 70 ? (color === 'amber' ? 'bg-amber-500' : 'bg-blue-500') : 'bg-red-400'}`}
                                  style={{ width: `${Math.min(100, computedPct ?? 0)}%` }}
                                />
                              </div>
                              <span className={`text-sm font-bold ${(computedPct ?? 0) >= 100 ? 'text-green-700' : (computedPct ?? 0) >= 70 ? 'text-amber-700' : 'text-red-600'}`}>
                                {computedPct?.toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Achieved: {displayVal.toLocaleString()} / {effectiveTarget.toLocaleString()}{unit ? ` ${unit}` : ""}</span>
                              <span>Weighted Score: {weightedScore?.toFixed(1)} (Weight: {crit.weight}%)</span>
                            </div>
                          </div>
                        )}

                        <div>
                          <Label>Comments</Label>
                          <textarea
                            value={myVal.note}
                            onChange={e => handleScoreChange(crit.id, 'note', e.target.value)}
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-border text-sm min-h-[70px]"
                            placeholder={isSelf ? "Provide evidence or examples..." : "Provide managerial feedback..."}
                          />
                        </div>
                      </div>
                    );
                  }
                  // Default: rating (1-5 slider)
                  return (
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <Label>Rating (1–5)</Label>
                          <span className={`font-bold ${color === 'amber' ? 'text-amber-700' : 'text-blue-700'}`}>{myVal.score}</span>
                        </div>
                        <input
                          type="range" min="1" max="5" step="1"
                          value={myVal.score}
                          onChange={e => handleScoreChange(crit.id, 'score', parseInt(e.target.value))}
                          className={`w-full ${color === 'amber' ? 'accent-amber-600' : 'accent-blue-600'}`}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>Needs Improvement</span><span>Exceptional</span>
                        </div>
                      </div>
                      <div>
                        <Label>Comments</Label>
                        <textarea
                          value={myVal.note}
                          onChange={e => handleScoreChange(crit.id, 'note', e.target.value)}
                          className="w-full mt-1 px-3 py-2 rounded-lg border border-border text-sm min-h-[80px]"
                          placeholder={isSelf ? "Provide evidence or examples..." : "Provide managerial feedback..."}
                        />
                      </div>
                    </div>
                  );
                };

                const renderScoreDisplay = (scoreVal: any, noteVal: any, waitingMsg?: string) => {
                  const actualVal = scoreItem.actualValue != null ? Number(scoreItem.actualValue) : null;
                  const displayPct = actualVal != null && effectiveTarget > 0 ? Math.min(100, (actualVal / effectiveTarget) * 100) : null;
                  const displayWeighted = displayPct != null ? (displayPct / 100) * (Number(crit.weight) / 100) * 100 : null;
                  return (
                    <div>
                      {(critType === "percentage" || critType === "value") && budget > 0 && (
                        <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg mb-2">
                          <Target className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="text-xs font-semibold text-emerald-700">Budget Target Achieved: {effectiveTarget.toLocaleString()}{unit ? ` ${unit}` : ""}</span>
                          {periodLabel && <span className="text-xs text-emerald-600">({periodLabel})</span>}
                        </div>
                      )}
                      {(critType === "percentage" || critType === "value") && actualVal != null ? (
                        <div className="mb-2">
                          <span className="text-xs text-muted-foreground">Actual: </span>
                          <span className="font-semibold">{actualVal.toLocaleString()}{unit ? ` ${unit}` : ""}</span>
                          <span className="text-xs text-muted-foreground ml-1">/ {effectiveTarget.toLocaleString()}{unit ? ` ${unit}` : ""}</span>
                          {displayPct != null && (
                            <span className={`ml-2 text-sm font-bold ${displayPct >= 100 ? 'text-green-700' : displayPct >= 70 ? 'text-amber-700' : 'text-red-600'}`}>
                              ({displayPct.toFixed(1)}%)
                            </span>
                          )}
                          {displayWeighted != null && (
                            <span className="text-xs text-muted-foreground ml-1">Weighted Score: {displayWeighted.toFixed(1)} (Weight: {crit.weight}%)</span>
                          )}
                        </div>
                      ) : null}
                      <div className="text-3xl font-bold text-foreground mb-2">{scoreVal != null ? <>{Number(scoreVal).toFixed(1)}/5 <span className="text-lg text-muted-foreground font-semibold">({(Number(scoreVal) / 5 * 100).toFixed(0)}%)</span></> : '-'}</div>
                      <p className="text-sm text-muted-foreground italic">{noteVal || waitingMsg || 'No comments provided.'}</p>
                    </div>
                  );
                };

                return (
                  <div className="grid md:grid-cols-2 gap-8 mt-6 pt-6 border-t border-border">
                    {/* Self Review Column */}
                    <div className={`p-4 rounded-xl ${isSelfReviewActive ? 'bg-amber-50/50 border border-amber-200' : 'bg-muted/30'}`}>
                      <h5 className="font-semibold text-sm mb-4 flex items-center gap-2">
                        <User className="w-4 h-4 text-amber-600" /> Self Evaluation
                      </h5>
                      {isSelfReviewActive
                        ? renderScoreInput("amber", true, true)
                        : renderScoreDisplay(scoreItem.selfScore, scoreItem.selfNote, "No comments provided.")
                      }
                    </div>

                    {/* Manager Review Column */}
                    <div className={`p-4 rounded-xl ${(isManagerReviewActive || appraisal.status === 'completed') ? 'bg-blue-50/50 border border-blue-200' : 'bg-muted/30 opacity-50'}`}>
                      <h5 className="font-semibold text-sm mb-4 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-600" /> Manager Evaluation
                      </h5>
                      {isManagerReviewActive
                        ? renderScoreInput("blue", true, false)
                        : renderScoreDisplay(scoreItem.managerScore, scoreItem.managerNote, "Waiting for manager review.")
                      }
                    </div>
                  </div>
                );
              })()}
            </Card>
          );
        })}
      </div>

      {/* Reviewer Evaluations — shown when there are per-reviewer scores */}
      {(() => {
        const reviewerScores: any[] = (appraisal as any).reviewerScores ?? [];
        if (reviewerScores.length === 0) return null;

        // Build a map: criterionId → criterion info
        const critMap: Record<number, any> = {};
        appraisal.scores.forEach((s: any) => { if (s.criterion) critMap[s.criterionId] = s.criterion; });

        return (
          <div className="space-y-4 mb-8">
            <h3 className="text-xl font-bold border-b border-border pb-2 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> Reviewer Evaluations
              <span className="text-sm font-normal text-muted-foreground ml-1">({reviewerScores.length} reviewer{reviewerScores.length > 1 ? "s" : ""})</span>
            </h3>
            {reviewerScores.map((rev: any, idx: number) => (
              <Card key={rev.reviewerId} className="overflow-hidden">
                {/* Reviewer header */}
                <div className="flex items-center justify-between px-5 py-4 bg-muted/20 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
                      {rev.reviewerName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold">{rev.reviewerName}</p>
                      <p className="text-xs text-muted-foreground capitalize">{rev.reviewerRole} · Step {idx + 1}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {rev.stepStatus === 'completed' && <span className="text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">Completed</span>}
                    {rev.stepStatus === 'in_progress' && <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full">In Progress</span>}
                    {rev.stepStatus === 'pending' && <span className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">Pending</span>}
                    {rev.reviewedAt && (
                      <span className="text-xs text-muted-foreground ml-1">{format(new Date(rev.reviewedAt), 'MMM d, yyyy')}</span>
                    )}
                  </div>
                </div>

                {/* Per-criterion scores */}
                {rev.scores.length > 0 ? (
                  <div className="p-5">
                    <div className="space-y-2">
                      {rev.scores.map((s: any) => {
                        const crit = critMap[s.criterionId];
                        return (
                          <div key={s.criterionId} className="flex items-center gap-4 p-3 bg-muted/30 rounded-xl">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{crit?.name ?? `Criterion #${s.criterionId}`}</p>
                              {s.note && <p className="text-xs text-muted-foreground mt-0.5 italic truncate">{s.note}</p>}
                            </div>
                            {s.actualValue != null && crit?.targetValue && (
                              <span className="text-xs text-muted-foreground shrink-0">
                                {Number(s.actualValue).toLocaleString()} / {Number(crit.targetValue).toLocaleString()}{crit.unit ? ` ${crit.unit}` : ""}
                              </span>
                            )}
                            <div className="shrink-0 text-right">
                              <span className="text-base font-bold text-primary">{Number(s.score).toFixed(1)}</span>
                              <span className="text-xs text-muted-foreground">/5</span>
                              <span className="text-xs text-muted-foreground ml-1">({(Number(s.score) / 5 * 100).toFixed(0)}%)</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Average score */}
                    {rev.scores.length > 1 && (() => {
                      const avg = rev.scores.reduce((sum: number, s: any) => sum + Number(s.score), 0) / rev.scores.length;
                      return (
                        <div className="flex items-center justify-end pt-3 mt-3 border-t border-border gap-2">
                          <span className="text-sm text-muted-foreground">Average score:</span>
                          <span className="text-xl font-bold text-primary">{avg.toFixed(2)}</span>
                          <span className="text-sm text-muted-foreground">/5</span>
                          <span className="text-sm font-semibold text-muted-foreground">({(avg / 5 * 100).toFixed(0)}%)</span>
                        </div>
                      );
                    })()}
                    {/* Reviewer overall comment */}
                    {rev.comment && (
                      <div className="mt-4 flex items-start gap-2 p-3 bg-blue-50/60 border border-blue-200 rounded-xl">
                        <MessageSquare className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-blue-700 mb-1">Overall Comment</p>
                          <p className="text-sm">{rev.comment}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-5 text-sm text-muted-foreground italic">
                    {rev.stepStatus === 'pending' ? 'Not yet started.' : rev.stepStatus === 'in_progress' ? 'Review in progress — scores not yet submitted.' : 'No scores recorded.'}
                  </div>
                )}
              </Card>
            ))}
          </div>
        );
      })()}

      {/* General Comments Section */}
      <Card className="p-6 mb-8">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> General Comments</h3>
        
        {canEdit ? (
          <div>
            <Label>Overall {isSelfReviewActive ? 'Self' : 'Manager'} Summary</Label>
            <textarea 
              value={generalComment}
              onChange={(e) => setGeneralComment(e.target.value)}
              className="w-full mt-2 px-4 py-3 rounded-xl border border-border min-h-[120px] focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="Summarize the performance period..."
            />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-muted/30 p-4 rounded-xl">
              <h5 className="font-semibold text-sm mb-2 text-muted-foreground">Self Summary</h5>
              <p className="text-sm">{appraisal.selfComment || 'None provided.'}</p>
            </div>
            <div className="bg-muted/30 p-4 rounded-xl">
              <h5 className="font-semibold text-sm mb-2 text-muted-foreground">Manager Summary</h5>
              <p className="text-sm">{appraisal.managerComment || 'None provided.'}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Admin Approval Section */}
      {isPendingAdminApproval && (
        <Card className="p-6 mb-8 border-purple-200 bg-purple-50/40">
          <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-600" />
            Admin Review &amp; Approval
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            The manager has submitted their review. All self and manager scores are visible below.
            Review the full appraisal and approve to mark it as complete.
          </p>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            {appraisal.scores.map(s => (
              <div key={s.id} className="bg-background rounded-xl p-4 border border-border text-sm">
                <p className="font-semibold mb-2">{s.criterion?.name}</p>
                <div className="flex justify-between text-muted-foreground">
                  <span>Self: <strong className="text-foreground">{s.selfScore ?? '—'}</strong>{s.selfScore != null && <span className="text-xs ml-1">({(Number(s.selfScore) / 5 * 100).toFixed(0)}%)</span>}</span>
                  <span>Manager: <strong className="text-foreground">{s.managerScore ?? '—'}</strong>{s.managerScore != null && <span className="text-xs ml-1">({(Number(s.managerScore) / 5 * 100).toFixed(0)}%)</span>}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
              isLoading={updateMutation.isPending}
              onClick={() => {
                if (confirm('Approve this appraisal? This will mark it as completed.')) {
                  updateMutation.mutate(
                    { id: appraisalId, data: { action: 'submit' } as any },
                    { onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/appraisals/${appraisalId}`] }) }
                  );
                }
              }}
            >
              <ThumbsUp className="w-4 h-4" /> Approve &amp; Complete
            </Button>
          </div>
        </Card>
      )}

      {/* Admin: Set Back-Office Actual Values */}
      {(user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'manager') &&
        appraisal.status !== 'completed' && (() => {
        const valueCriteria = appraisal.scores.filter(s => {
          const t = s.criterion?.type ?? "rating";
          return t === "value" || t === "percentage";
        });
        if (valueCriteria.length === 0) return null;
        return (
          <Card className="p-6 mb-8 border-blue-200 bg-blue-50/30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                Back-Office Actual Values
              </h3>
              <Button
                variant="outline"
                size="sm"
                className="border-blue-300 text-blue-700 hover:bg-blue-100"
                onClick={() => {
                  if (!showAdminActuals) {
                    const init: Record<number, string> = {};
                    valueCriteria.forEach(s => {
                      const existing = Number(s.adminActualValue ?? (s as Record<string, unknown>).admin_actual_value ?? 0);
                      if (existing > 0) init[s.criterionId] = String(existing);
                    });
                    setAdminActualValues(init);
                  }
                  setShowAdminActuals(!showAdminActuals);
                }}
              >
                {showAdminActuals ? "Cancel" : "Edit Values"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Enter the official actual values from back-office computation. The employee will see these and can submit a counter value if they disagree.
            </p>
            {!showAdminActuals ? (
              <div className="space-y-2">
                {valueCriteria.map(s => {
                  const crit = s.criterion;
                  const val = Number(s.adminActualValue ?? (s as Record<string, unknown>).admin_actual_value ?? 0);
                  const empVal = Number(s.actualValue ?? 0);
                  const hasDispute = val > 0 && empVal > 0 && Math.abs(val - empVal) > 0.01;
                  return (
                    <div key={s.criterionId} className="flex items-center justify-between py-2 px-3 bg-white/60 rounded-lg">
                      <span className="text-sm font-medium">{crit?.name}</span>
                      <div className="flex items-center gap-3">
                        {val > 0 ? (
                          <span className="text-sm font-bold text-blue-700">{val.toLocaleString()}{crit?.unit ? ` ${crit.unit}` : ""}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not set</span>
                        )}
                        {hasDispute && (
                          <span className="text-xs font-semibold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">Disputed</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {valueCriteria.map(s => {
                  const crit = s.criterion;
                  return (
                    <div key={s.criterionId} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{crit?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Budget Target: {Number(s.budgetValue ?? (s as Record<string, unknown>).budget_value ?? crit?.targetValue ?? 0).toLocaleString()}{crit?.unit ? ` ${crit.unit}` : ""}
                        </p>
                      </div>
                      <input
                        type="number" min="0" step="0.01"
                        className="w-44 px-3 py-2 rounded-lg border border-blue-300 text-sm outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                        placeholder="Actual value"
                        value={adminActualValues[s.criterionId] ?? ""}
                        onChange={e => setAdminActualValues(prev => ({ ...prev, [s.criterionId]: e.target.value }))}
                      />
                      {crit?.unit && <span className="text-xs text-muted-foreground shrink-0">{crit.unit}</span>}
                    </div>
                  );
                })}
                <div className="flex justify-end pt-2">
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                    isLoading={savingAdminActuals}
                    onClick={handleSaveAdminActuals}
                  >
                    <ShieldCheck className="w-4 h-4" /> Save Back-Office Values
                  </Button>
                </div>
              </div>
            )}
          </Card>
        );
      })()}

      {/* Resend for Review — available for admins/managers when appraisal is beyond self_review */}
      {(user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'manager') &&
        ['manager_review', 'pending_approval', 'completed'].includes(appraisal.status) && (
        <Card className="p-6 mb-8 border-orange-200 bg-orange-50/40">
          <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-orange-600" />
            Resend for Review
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            If the budget values or scores are incorrect, you can send this appraisal back to the employee for re-evaluation.
            This will reset all reviewer scores and return the appraisal to self-review status.
          </p>
          <div className="flex justify-end">
            <Button
              variant="outline"
              className="border-orange-300 text-orange-700 hover:bg-orange-100 gap-2"
              isLoading={updateMutation.isPending}
              onClick={() => {
                if (confirm('Resend this appraisal for review? This will reset all reviewer scores and return it to self-review status.')) {
                  updateMutation.mutate(
                    { id: appraisalId, data: { action: 'resend_review' } as any },
                    { onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/appraisals/${appraisalId}`] }) }
                  );
                }
              }}
            >
              <RotateCcw className="w-4 h-4" /> Resend for Review
            </Button>
          </div>
        </Card>
      )}

      {/* Request Readjustment — available for employees when their appraisal is beyond self_review */}
      {user?.id === appraisal.employeeId &&
        ['manager_review', 'pending_approval'].includes(appraisal.status) && (
        <Card className="p-6 mb-8 border-amber-200 bg-amber-50/40">
          <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-amber-600" />
            Request Readjustment
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            If you believe the budget values, scores, or feedback need to be corrected, you can request a readjustment.
            This will send the appraisal back to self-review so you can update your responses.
          </p>
          <div className="flex justify-end">
            <Button
              variant="outline"
              className="border-amber-300 text-amber-700 hover:bg-amber-100 gap-2"
              isLoading={updateMutation.isPending}
              onClick={() => {
                if (confirm('Request readjustment? This will return the appraisal to self-review status so you can make changes. All reviewer scores will be reset.')) {
                  updateMutation.mutate(
                    { id: appraisalId, data: { action: 'resend_review' } as any },
                    { onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/appraisals/${appraisalId}`] }) }
                  );
                }
              }}
            >
              <RotateCcw className="w-4 h-4" /> Request Readjustment
            </Button>
          </div>
        </Card>
      )}

      {/* Actions */}
      {canEdit && (
        <div className="flex justify-end gap-4 p-4 bg-card border border-border rounded-2xl shadow-lg sticky bottom-6">
          <Button variant="outline" onClick={() => handleSubmit('save')} isLoading={updateMutation.isPending}>
            Save Draft
          </Button>
          <Button onClick={() => {
            if(confirm('Are you sure you want to submit? You cannot edit after submitting.')) {
              handleSubmit('submit');
            }
          }} isLoading={updateMutation.isPending}>
            Submit Review
          </Button>
        </div>
      )}
    </div>
  );
}
