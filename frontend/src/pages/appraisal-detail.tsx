import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useGetAppraisal, useUpdateAppraisal } from "../lib";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader, Card, StatusBadge, Button, Label } from "@/components/shared";
import { useAuth } from "@/hooks/use-auth";
import { CheckCircle2, User, Star, FileText, ShieldCheck, ThumbsUp, ArrowRight, Users } from "lucide-react";

const WORKFLOW_ROUTES: Record<string, { label: string; steps: string[] }> = {
  self_only:       { label: "Self Only",              steps: ["Self Review", "Completed"] },
  manager_review:  { label: "Employee → Manager",     steps: ["Self Review", "Manager Review", "Completed"] },
  admin_approval:  { label: "Full Approval",          steps: ["Self Review", "Manager Review", "Admin Approval", "Completed"] },
};

export default function AppraisalDetail() {
  const [, params] = useRoute("/appraisals/:id");
  const appraisalId = params?.id ? parseInt(params.id) : 0;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };

  const { data: appraisal, isLoading } = useGetAppraisal(appraisalId, {
    request: { headers },
    query: { enabled: !!appraisalId } as any
  });

  const updateMutation = useUpdateAppraisal({ request: { headers } });

  // Local form state for scores
  const [scores, setScores] = useState<Record<number, { score: number, note: string, actualValue?: number }>>({});
  const [generalComment, setGeneralComment] = useState("");

  useEffect(() => {
    if (appraisal) {
      const initialScores: Record<number, { score: number, note: string, actualValue?: number }> = {};
      const isSelf = appraisal.status === 'self_review';

      appraisal.scores.forEach(s => {
        initialScores[s.criterionId] = {
          score: Number((isSelf ? s.selfScore : s.managerScore) ?? 3) || 3,
          note: (isSelf ? s.selfNote : s.managerNote) || "",
          actualValue: s.actualValue ? Number(s.actualValue) : undefined,
        };
      });
      setScores(initialScores);
      setGeneralComment((isSelf ? appraisal.selfComment : appraisal.managerComment) || "");
    }
  }, [appraisal]);

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

  const handleActualValueChange = (criterionId: number, actualVal: number, targetVal: number) => {
    const computed = targetVal > 0 ? Math.min(5, (actualVal / targetVal) * 5) : 0;
    setScores(prev => ({
      ...prev,
      [criterionId]: { ...prev[criterionId], actualValue: actualVal, score: Math.round(computed * 10) / 10 }
    }));
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
        onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/appraisals/${appraisalId}`] })
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
              </div>
            )}
          </div>
        </div>
      </Card>

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
                        {crit.type}{crit.targetValue || (crit as any).target_value ? ` · Target: ${crit.targetValue ?? (crit as any).target_value}${crit.unit ? ` ${crit.unit}` : ""}` : ""}
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

                const ScoreInput = ({ color, isActive, isSelf }: { color: string; isActive: boolean; isSelf: boolean }) => {
                  if (!isActive) return null;
                  if (critType === "percentage" || critType === "value") {
                    const computedPct = target > 0 && myVal.actualValue != null ? Math.min(100, (myVal.actualValue / target) * 100) : null;
                    return (
                      <div className="space-y-3">
                        <div>
                          <Label>{critType === "percentage" ? `Actual %${unit ? ` (${unit})` : ""}` : `Actual Value${unit ? ` (${unit})` : ""}`}</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="number" min="0" step="0.01"
                              value={myVal.actualValue ?? ""}
                              onChange={e => handleActualValueChange(crit.id, parseFloat(e.target.value) || 0, target)}
                              className="flex-1 px-3 py-2 rounded-lg border border-border text-sm outline-none focus:ring-2 focus:ring-primary/20"
                              placeholder={critType === "percentage" ? `e.g. 85 (target: ${target}%)` : `e.g. ${target * 0.8} (target: ${target}${unit ? ` ${unit}` : ""})`}
                            />
                            {unit && <span className="text-sm text-muted-foreground font-medium shrink-0">{unit}</span>}
                          </div>
                          {myVal.actualValue != null && target > 0 && (
                            <div className="mt-2 flex items-center gap-3">
                              <div className="flex-1 bg-muted rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full transition-all ${color === 'amber' ? 'bg-amber-500' : 'bg-blue-500'}`}
                                  style={{ width: `${Math.min(100, computedPct ?? 0)}%` }}
                                />
                              </div>
                              <span className={`text-xs font-bold ${color === 'amber' ? 'text-amber-700' : 'text-blue-700'}`}>
                                {computedPct?.toFixed(0)}% → Score: {myVal.score.toFixed(1)}/5
                              </span>
                            </div>
                          )}
                        </div>
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

                const ScoreDisplay = ({ scoreVal, noteVal, waitingMsg }: { scoreVal: any; noteVal: any; waitingMsg?: string }) => (
                  <div>
                    {(critType === "percentage" || critType === "value") && scoreItem.actualValue != null ? (
                      <div className="mb-2">
                        <span className="text-xs text-muted-foreground">Actual: </span>
                        <span className="font-semibold">{Number(scoreItem.actualValue).toLocaleString()}{unit ? ` ${unit}` : ""}</span>
                        {target > 0 && <span className="text-xs text-muted-foreground ml-1">/ {target.toLocaleString()}{unit ? ` ${unit}` : ""} target</span>}
                      </div>
                    ) : null}
                    <div className="text-3xl font-bold text-foreground mb-2">{scoreVal != null ? `${Number(scoreVal).toFixed(1)}/5` : '-'}</div>
                    <p className="text-sm text-muted-foreground italic">{noteVal || waitingMsg || 'No comments provided.'}</p>
                  </div>
                );

                return (
                  <div className="grid md:grid-cols-2 gap-8 mt-6 pt-6 border-t border-border">
                    {/* Self Review Column */}
                    <div className={`p-4 rounded-xl ${isSelfReviewActive ? 'bg-amber-50/50 border border-amber-200' : 'bg-muted/30'}`}>
                      <h5 className="font-semibold text-sm mb-4 flex items-center gap-2">
                        <User className="w-4 h-4 text-amber-600" /> Self Evaluation
                      </h5>
                      {isSelfReviewActive
                        ? <ScoreInput color="amber" isActive={true} isSelf={true} />
                        : <ScoreDisplay scoreVal={scoreItem.selfScore} noteVal={scoreItem.selfNote} waitingMsg="No comments provided." />
                      }
                    </div>

                    {/* Manager Review Column */}
                    <div className={`p-4 rounded-xl ${(isManagerReviewActive || appraisal.status === 'completed') ? 'bg-blue-50/50 border border-blue-200' : 'bg-muted/30 opacity-50'}`}>
                      <h5 className="font-semibold text-sm mb-4 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-600" /> Manager Evaluation
                      </h5>
                      {isManagerReviewActive
                        ? <ScoreInput color="blue" isActive={true} isSelf={false} />
                        : <ScoreDisplay scoreVal={scoreItem.managerScore} noteVal={scoreItem.managerNote} waitingMsg="Waiting for manager review." />
                      }
                    </div>
                  </div>
                );
              })()}
            </Card>
          );
        })}
      </div>

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
                  <span>Self: <strong className="text-foreground">{s.selfScore ?? '—'}</strong></span>
                  <span>Manager: <strong className="text-foreground">{s.managerScore ?? '—'}</strong></span>
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
