import { useState } from "react";
import { useListAppraisals, useCreateAppraisal, useListCycles, useListUsers } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader, Card, StatusBadge, Button, EmptyState, Label } from "@/components/shared";
import { format } from "date-fns";
import { ClipboardList, Plus, X, User as UserIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";

export default function Appraisals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
  
  const { data: appraisals, isLoading } = useListAppraisals({}, { request: { headers } });
  const { data: cycles } = useListCycles({ request: { headers } });
  const { data: users } = useListUsers({ request: { headers } }); // Admin only endpoint usually, but we need it to select employee

  const createMutation = useCreateAppraisal({ request: { headers } });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ cycleId: "", employeeId: "", workflowType: "admin_approval" });

  const WORKFLOW_OPTIONS = [
    { value: "self_only",      label: "Self Only",           desc: "Employee self-review → Completed" },
    { value: "manager_review", label: "Employee → Manager",  desc: "Self-review → Manager review → Completed" },
    { value: "admin_approval", label: "Full Approval",       desc: "Self-review → Manager review → Admin approval → Completed" },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(
      { data: { cycleId: parseInt(formData.cycleId), employeeId: parseInt(formData.employeeId), workflowType: formData.workflowType } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/appraisals"] });
          setIsDialogOpen(false);
        }
      }
    );
  };

  if (isLoading) return <div className="p-8">Loading appraisals...</div>;

  return (
    <div>
      <PageHeader title="Appraisals" description="Manage performance reviews and evaluations.">
        {user?.role !== 'employee' && (
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Start Appraisal
          </Button>
        )}
      </PageHeader>

      <Card className="overflow-hidden">
        {appraisals?.length === 0 ? (
          <EmptyState title="No appraisals found" description="There are no active appraisals right now." icon={ClipboardList} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-sm font-semibold text-muted-foreground">
                  <th className="p-4">Employee</th>
                  <th className="p-4">Cycle</th>
                  <th className="p-4 hidden md:table-cell">Reviewer</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Score</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {appraisals?.map((app) => (
                  <tr key={app.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                          {app.employee.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{app.employee.name}</p>
                          <p className="text-xs text-muted-foreground hidden sm:block">{app.employee.department || 'No department'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm font-medium">{app.cycle.name}</td>
                    <td className="p-4 hidden md:table-cell text-sm text-muted-foreground">{app.reviewer?.name || 'Unassigned'}</td>
                    <td className="p-4"><StatusBadge status={app.status} type="appraisal" /></td>
                    <td className="p-4">
                      {app.overallScore !== null ? (
                        <span className="font-bold text-lg">{Number(app.overallScore).toFixed(1)}<span className="text-sm text-muted-foreground font-normal">/5</span></span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <Link href={`/appraisals/${app.id}`}>
                        <Button variant="outline" size="sm">View</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-bold">Start New Appraisal</h2>
              <button onClick={() => setIsDialogOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <Label>Select Employee</Label>
                <select 
                  className="w-full px-4 py-2.5 rounded-xl bg-background border border-border outline-none focus:ring-2 focus:ring-primary/20"
                  value={formData.employeeId}
                  onChange={e => setFormData({...formData, employeeId: e.target.value})}
                  required
                >
                  <option value="">-- Choose employee --</option>
                  {users?.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Select Cycle</Label>
                <select 
                  className="w-full px-4 py-2.5 rounded-xl bg-background border border-border outline-none focus:ring-2 focus:ring-primary/20"
                  value={formData.cycleId}
                  onChange={e => setFormData({...formData, cycleId: e.target.value})}
                  required
                >
                  <option value="">-- Choose cycle --</option>
                  {cycles?.filter(c => c.status === 'active').map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Review Route</Label>
                <div className="space-y-2 mt-1">
                  {WORKFLOW_OPTIONS.map(opt => (
                    <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${formData.workflowType === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}>
                      <input
                        type="radio"
                        name="workflowType"
                        value={opt.value}
                        checked={formData.workflowType === opt.value}
                        onChange={() => setFormData({ ...formData, workflowType: opt.value })}
                        className="mt-0.5 accent-primary"
                      />
                      <div>
                        <p className="font-medium text-sm">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" isLoading={createMutation.isPending}>Start Appraisal</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
