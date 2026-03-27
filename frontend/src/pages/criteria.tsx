import { useState } from "react";
import { useListCriteria, useCreateCriterion, useUpdateCriterion, useDeleteCriterion } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader, Card, Button, Input, Label, EmptyState } from "@/components/shared";
import { ListChecks, Plus, X, Trash2, Edit2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function Criteria() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
  
  const { data: criteria, isLoading } = useListCriteria({ request: { headers } });
  
  const createMutation = useCreateCriterion({ request: { headers } });
  const updateMutation = useUpdateCriterion({ request: { headers } });
  const deleteMutation = useDeleteCriterion({ request: { headers } });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "", category: "Core", weight: 10 });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...formData, weight: Number(formData.weight) };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/criteria"] }); setIsDialogOpen(false); }
      });
    } else {
      createMutation.mutate({ data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/criteria"] }); setIsDialogOpen(false); }
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this criterion?")) deleteMutation.mutate({ id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/criteria"] }) });
  };

  if (isLoading) return <div className="p-8">Loading criteria...</div>;
  if (user?.role !== 'admin' && user?.role !== 'super_admin') return <div className="p-8 text-destructive">Unauthorized</div>;

  // Group by category
  const grouped = criteria?.reduce((acc, curr) => {
    (acc[curr.category] = acc[curr.category] || []).push(curr);
    return acc;
  }, {} as Record<string, typeof criteria>);

  return (
    <div>
      <PageHeader title="Evaluation Criteria" description="Configure the competencies and metrics used in appraisals.">
        <Button onClick={() => { setFormData({ name: "", description: "", category: "Core", weight: 10 }); setEditingId(null); setIsDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Criterion
        </Button>
      </PageHeader>

      {!criteria?.length ? (
        <EmptyState title="No criteria defined" description="Add evaluation metrics to build the appraisal rubrics." icon={ListChecks} />
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped || {}).map(([category, items]) => (
            <div key={category} className="space-y-4">
              <h3 className="text-lg font-bold font-display flex items-center gap-2">
                <div className="w-2 h-6 bg-primary rounded-full"></div>
                {category} Competencies
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(crit => (
                  <Card key={crit.id} className="p-5 flex flex-col group">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-foreground">{crit.name}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setFormData({ name: crit.name, description: crit.description||"", category: crit.category, weight: crit.weight }); setEditingId(crit.id); setIsDialogOpen(true); }} className="text-muted-foreground hover:text-primary"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(crit.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground flex-1 mb-4">{crit.description}</p>
                    <div className="bg-muted px-3 py-1.5 rounded-lg inline-flex self-start text-xs font-medium text-foreground">
                      Weight: {crit.weight}%
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">{editingId ? "Edit" : "Create"} Criterion</h2>
              <button onClick={() => setIsDialogOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><Label>Name</Label><Input value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} required /></div>
              <div><Label>Category</Label><Input value={formData.category} onChange={e=>setFormData({...formData, category: e.target.value})} required placeholder="e.g. Core, Leadership, Technical" /></div>
              <div><Label>Description</Label><textarea className="w-full border rounded-xl px-4 py-2 min-h-[80px]" value={formData.description} onChange={e=>setFormData({...formData, description: e.target.value})} /></div>
              <div><Label>Weight (%)</Label><Input type="number" value={formData.weight} onChange={e=>setFormData({...formData, weight: parseInt(e.target.value)})} required min="1" max="100" /></div>
              <Button className="w-full mt-4" type="submit" isLoading={createMutation.isPending || updateMutation.isPending}>Save</Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
