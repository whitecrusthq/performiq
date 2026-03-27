import { useState } from "react";
import { useListGoals, useCreateGoal, useUpdateGoal, useDeleteGoal, useListUsers } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader, Card, StatusBadge, Button, Input, Label, EmptyState } from "@/components/shared";
import { Target, Plus, X, Trash2, Edit2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function Goals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
  
  const { data: goals, isLoading } = useListGoals({}, { request: { headers } });
  const { data: users } = useListUsers({ request: { headers }, query: { enabled: user?.role !== 'employee' } });

  const createMutation = useCreateGoal({ request: { headers } });
  const updateMutation = useUpdateGoal({ request: { headers } });
  const deleteMutation = useDeleteGoal({ request: { headers } });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    title: "", description: "", dueDate: "", progress: 0, status: "not_started" as any, userId: ""
  });

  const openCreate = () => {
    setFormData({ title: "", description: "", dueDate: "", progress: 0, status: "not_started", userId: user?.id.toString() || "" });
    setEditingId(null);
    setIsDialogOpen(true);
  };

  const openEdit = (goal: any) => {
    setFormData({
      title: goal.title,
      description: goal.description || "",
      dueDate: goal.dueDate ? goal.dueDate.split('T')[0] : "",
      progress: goal.progress,
      status: goal.status,
      userId: goal.userId.toString()
    });
    setEditingId(goal.id);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      title: formData.title,
      description: formData.description,
      status: formData.status,
      progress: parseInt(formData.progress.toString())
    };
    if (formData.dueDate) payload.dueDate = new Date(formData.dueDate);
    if (!editingId && user?.role !== 'employee') payload.userId = parseInt(formData.userId);

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/goals"] }); setIsDialogOpen(false); }
      });
    } else {
      createMutation.mutate({ data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/goals"] }); setIsDialogOpen(false); }
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this goal?")) {
      deleteMutation.mutate({ id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/goals"] }) });
    }
  };

  if (isLoading) return <div className="p-8">Loading goals...</div>;

  return (
    <div>
      <PageHeader title="Performance Goals" description="Track objectives and key results.">
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2"/> New Goal</Button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {goals?.length === 0 && (
          <div className="col-span-full">
            <EmptyState title="No goals set" description="Create a goal to start tracking progress." icon={Target} />
          </div>
        )}
        
        {goals?.map(goal => (
          <Card key={goal.id} className="p-6 flex flex-col relative group">
            <div className="flex justify-between items-start mb-3">
              <StatusBadge status={goal.status} type="goal" />
              {(user?.role === 'admin' || user?.role === 'super_admin' || user?.id === goal.userId) && (
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(goal)} className="p-1 text-muted-foreground hover:text-primary"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(goal.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                </div>
              )}
            </div>
            
            <h3 className="text-xl font-bold leading-tight mb-2">{goal.title}</h3>
            {user?.role !== 'employee' && <p className="text-xs font-medium text-primary mb-3">Assignee: {goal.user.name}</p>}
            <p className="text-sm text-muted-foreground line-clamp-2 mb-6 flex-1">{goal.description}</p>
            
            <div className="mt-auto">
              <div className="flex justify-between text-sm mb-2 font-medium">
                <span>Progress</span>
                <span className={goal.progress === 100 ? "text-emerald-600" : "text-primary"}>{goal.progress}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ${goal.progress === 100 ? 'bg-emerald-500' : 'bg-primary'}`} 
                  style={{ width: `${goal.progress}%` }}
                ></div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg shadow-2xl p-0 overflow-hidden">
            <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
              <h2 className="text-xl font-bold">{editingId ? "Update Goal" : "Create New Goal"}</h2>
              <button onClick={() => setIsDialogOpen(false)}><X className="w-5 h-5 text-muted-foreground hover:text-foreground" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {user?.role !== 'employee' && !editingId && (
                <div>
                  <Label>Assign To</Label>
                  <select className="w-full px-4 py-2 border rounded-xl" value={formData.userId} onChange={e=>setFormData({...formData, userId: e.target.value})} required>
                    <option value="">Select user...</option>
                    {users?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <Label>Goal Title</Label>
                <Input value={formData.title} onChange={e=>setFormData({...formData, title: e.target.value})} required />
              </div>
              <div>
                <Label>Description</Label>
                <textarea className="w-full px-4 py-2 border rounded-xl min-h-[100px]" value={formData.description} onChange={e=>setFormData({...formData, description: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Status</Label>
                  <select className="w-full px-4 py-2 border rounded-xl" value={formData.status} onChange={e=>setFormData({...formData, status: e.target.value as any})}>
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <Label>Due Date</Label>
                  <Input type="date" value={formData.dueDate} onChange={e=>setFormData({...formData, dueDate: e.target.value})} />
                </div>
              </div>
              {editingId && (
                <div>
                  <div className="flex justify-between mb-1"><Label>Progress</Label><span>{formData.progress}%</span></div>
                  <input type="range" min="0" max="100" className="w-full accent-primary" value={formData.progress} onChange={e=>setFormData({...formData, progress: parseInt(e.target.value)})} />
                </div>
              )}
              <div className="flex justify-end pt-4 gap-3 border-t">
                <Button variant="ghost" type="button" onClick={()=>setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" isLoading={createMutation.isPending || updateMutation.isPending}>Save</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
