import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useGetAppraisal, useUpdateAppraisal } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader, Card, StatusBadge, Button, Label } from "@/components/shared";
import { useAuth } from "@/hooks/use-auth";
import { CheckCircle2, User, Star, FileText } from "lucide-react";

export default function AppraisalDetail() {
  const [, params] = useRoute("/appraisals/:id");
  const appraisalId = params?.id ? parseInt(params.id) : 0;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };

  const { data: appraisal, isLoading } = useGetAppraisal(appraisalId, {
    request: { headers },
    query: { enabled: !!appraisalId }
  });

  const updateMutation = useUpdateAppraisal({ request: { headers } });

  // Local form state for scores
  const [scores, setScores] = useState<Record<number, { score: number, note: string }>>({});
  const [generalComment, setGeneralComment] = useState("");

  useEffect(() => {
    if (appraisal) {
      const initialScores: Record<number, { score: number, note: string }> = {};
      const isSelf = appraisal.status === 'self_review';
      
      appraisal.scores.forEach(s => {
        initialScores[s.criterionId] = {
          score: (isSelf ? s.selfScore : s.managerScore) || 3,
          note: (isSelf ? s.selfNote : s.managerNote) || ""
        };
      });
      setScores(initialScores);
      setGeneralComment((isSelf ? appraisal.selfComment : appraisal.managerComment) || "");
    }
  }, [appraisal]);

  if (isLoading || !appraisal) return <div className="p-8 animate-pulse text-muted-foreground">Loading details...</div>;

  const isSelfReviewActive = appraisal.status === 'self_review' && user?.id === appraisal.employeeId;
  const isManagerReviewActive = appraisal.status === 'manager_review' && (user?.id === appraisal.reviewerId || user?.role === 'admin');
  const canEdit = isSelfReviewActive || isManagerReviewActive;

  const handleScoreChange = (criterionId: number, field: 'score' | 'note', value: any) => {
    setScores(prev => ({
      ...prev,
      [criterionId]: { ...prev[criterionId], [field]: value }
    }));
  };

  const handleSubmit = (action: 'save' | 'submit') => {
    const scoresArray = Object.entries(scores).map(([critId, data]) => {
      const base = { criterionId: parseInt(critId) };
      if (isSelfReviewActive) return { ...base, selfScore: data.score, selfNote: data.note };
      return { ...base, managerScore: data.score, managerNote: data.note };
    });

    const payload: any = { scores: scoresArray };
    
    if (isSelfReviewActive) {
      payload.selfComment = generalComment;
      if (action === 'submit') payload.status = 'manager_review';
    } else {
      payload.managerComment = generalComment;
      if (action === 'submit') payload.status = 'completed';
    }

    updateMutation.mutate(
      { id: appraisalId, data: payload },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/appraisals/${appraisalId}`] })
      }
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader title="Appraisal Detail" />

      {/* Header Info Card */}
      <Card className="p-6 mb-8 bg-gradient-to-br from-card to-muted/30">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold shadow-md">
              {appraisal.employee.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-2xl font-bold">{appraisal.employee.name}</h2>
              <p className="text-muted-foreground">{appraisal.employee.jobTitle || 'Employee'} • {appraisal.employee.department}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 items-start md:items-end bg-background p-4 rounded-xl border border-border shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Cycle:</span>
              <span className="font-semibold">{appraisal.cycle.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Status:</span>
              <StatusBadge status={appraisal.status} type="appraisal" />
            </div>
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
                  </div>
                  <h4 className="text-lg font-semibold">{crit.name}</h4>
                  <p className="text-muted-foreground text-sm mt-1">{crit.description}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-8 mt-6 pt-6 border-t border-border">
                {/* Self Review Column */}
                <div className={`p-4 rounded-xl ${isSelfReviewActive ? 'bg-amber-50/50 border border-amber-200' : 'bg-muted/30'}`}>
                  <h5 className="font-semibold text-sm mb-4 flex items-center gap-2">
                    <User className="w-4 h-4 text-amber-600" /> Self Evaluation
                  </h5>
                  
                  {isSelfReviewActive ? (
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <Label>Rating (1-5)</Label>
                          <span className="font-bold text-amber-700">{myVal.score}</span>
                        </div>
                        <input 
                          type="range" min="1" max="5" step="1" 
                          value={myVal.score} 
                          onChange={(e) => handleScoreChange(crit.id, 'score', parseInt(e.target.value))}
                          className="w-full accent-amber-600" 
                        />
                      </div>
                      <div>
                        <Label>Comments</Label>
                        <textarea 
                          value={myVal.note}
                          onChange={(e) => handleScoreChange(crit.id, 'note', e.target.value)}
                          className="w-full mt-1 px-3 py-2 rounded-lg border border-border text-sm min-h-[80px]"
                          placeholder="Provide evidence or examples..."
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-3xl font-bold text-foreground mb-2">{scoreItem.selfScore || '-'}</div>
                      <p className="text-sm text-muted-foreground italic">{scoreItem.selfNote || 'No comments provided.'}</p>
                    </div>
                  )}
                </div>

                {/* Manager Review Column */}
                <div className={`p-4 rounded-xl ${(isManagerReviewActive || appraisal.status === 'completed') ? 'bg-blue-50/50 border border-blue-200' : 'bg-muted/30 opacity-50'}`}>
                  <h5 className="font-semibold text-sm mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" /> Manager Evaluation
                  </h5>
                  
                  {isManagerReviewActive ? (
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <Label>Rating (1-5)</Label>
                          <span className="font-bold text-blue-700">{myVal.score}</span>
                        </div>
                        <input 
                          type="range" min="1" max="5" step="1" 
                          value={myVal.score} 
                          onChange={(e) => handleScoreChange(crit.id, 'score', parseInt(e.target.value))}
                          className="w-full accent-blue-600" 
                        />
                      </div>
                      <div>
                        <Label>Comments</Label>
                        <textarea 
                          value={myVal.note}
                          onChange={(e) => handleScoreChange(crit.id, 'note', e.target.value)}
                          className="w-full mt-1 px-3 py-2 rounded-lg border border-border text-sm min-h-[80px]"
                          placeholder="Provide managerial feedback..."
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-3xl font-bold text-foreground mb-2">{scoreItem.managerScore || '-'}</div>
                      <p className="text-sm text-muted-foreground italic">{scoreItem.managerNote || 'Waiting for manager review.'}</p>
                    </div>
                  )}
                </div>
              </div>
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
