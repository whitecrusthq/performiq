import { useState } from "react";
import { useListCycles, useCreateCycle, useUpdateCycle, useDeleteCycle } from "../lib";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader, Card, StatusBadge, Button, Input, Label, EmptyState } from "@/components/shared";
import { format } from "date-fns";
import { Calendar, Plus, Edit2, Trash2, X } from "lucide-react";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { useAuth } from "@/hooks/use-auth";

export default function Cycles() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
  
  const { data: cycles, isLoading } = useListCycles({ request: { headers } });
  const createMutation = useCreateCycle({ request: { headers } });
  const updateMutation = useUpdateCycle({ request: { headers } });
  const deleteMutation = useDeleteCycle({ request: { headers } });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    startDate: "",
    endDate: "",
    status: "draft" as "draft" | "active" | "closed"
  });

  const openCreate = () => {
    setFormData({ name: "", startDate: "", endDate: "", status: "draft" });
    setEditingId(null);
    setIsDialogOpen(true);
  };

  const openEdit = (cycle: any) => {
    setFormData({
      name: cycle.name,
      startDate: format(new Date(cycle.startDate), 'yyyy-MM-dd'),
      endDate: format(new Date(cycle.endDate), 'yyyy-MM-dd'),
      status: cycle.status
    });
    setEditingId(cycle.id);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      startDate: new Date(formData.startDate).toISOString(),
      endDate: new Date(formData.endDate).toISOString()
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/cycles"] });
          setIsDialogOpen(false);
        }
      });
    } else {
      createMutation.mutate({ data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/cycles"] });
          setIsDialogOpen(false);
        }
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this cycle?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/cycles"] })
      });
    }
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const visibleCycles = cycles ?? [];

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toggleSelect = (id: number) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (selectedIds.size === visibleCycles.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(visibleCycles.map(c => c.id)));
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} selected cycle(s)?`)) return;
    setBulkDeleting(true);
    await Promise.all([...selectedIds].map(id =>
      new Promise<void>(resolve => deleteMutation.mutate({ id }, { onSuccess: () => resolve(), onError: () => resolve() }))
    ));
    queryClient.invalidateQueries({ queryKey: ["/api/cycles"] });
    setSelectedIds(new Set());
    setBulkDeleting(false);
  };

  if (isLoading) return <div className="p-8">Loading cycles...</div>;

  return (
    <div>
      <PageHeader title="Appraisal Cycles" description="Manage performance review periods for the organization.">
        {(user?.role === 'admin' || user?.role === 'super_admin') && (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> New Cycle
          </Button>
        )}
      </PageHeader>

      {!cycles?.length ? (
        <EmptyState title="No cycles found" description="Create an appraisal cycle to start tracking performance." icon={Calendar} action={(user?.role === 'admin' || user?.role === 'super_admin') && <Button onClick={openCreate}>Create Cycle</Button>} />
      ) : (
        <>
          {isAdmin && <BulkActionBar count={selectedIds.size} onDelete={handleBulkDelete} onClear={() => setSelectedIds(new Set())} deleting={bulkDeleting} />}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {cycles.map((cycle) => (
              <Card key={cycle.id} className={`flex flex-col relative group ${selectedIds.has(cycle.id) ? "ring-2 ring-primary/30" : ""}`}>
                <div className="p-6 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(cycle.id)}
                          onChange={() => toggleSelect(cycle.id)}
                          className="w-4 h-4 accent-primary cursor-pointer"
                        />
                      )}
                      <StatusBadge status={cycle.status} type="cycle" />
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(cycle)} className="p-1.5 text-muted-foreground hover:text-primary bg-muted rounded-md"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(cycle.id)} className="p-1.5 text-muted-foreground hover:text-destructive bg-muted rounded-md"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>
                <h3 className="text-xl font-bold text-foreground mb-4">{cycle.name}</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4 mr-3 opacity-70" />
                    <span className="w-16">Starts:</span>
                    <span className="font-medium text-foreground">{format(new Date(cycle.startDate), 'MMM d, yyyy')}</span>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4 mr-3 opacity-70" />
                    <span className="w-16">Ends:</span>
                    <span className="font-medium text-foreground">{format(new Date(cycle.endDate), 'MMM d, yyyy')}</span>
                  </div>
                </div>
              </div>
            </Card>
            ))}
          </div>
        </>
      )}

      {/* Modal Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-bold">{editingId ? "Edit Cycle" : "Create New Cycle"}</h2>
              <button onClick={() => setIsDialogOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <Label>Cycle Name</Label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="e.g. Annual Review 2024" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date</Label>
                  <Input type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} required />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input type="date" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} required />
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <select 
                  className="w-full px-4 py-2.5 rounded-xl bg-background border border-border focus:border-primary focus:ring-4 focus:ring-primary/20 outline-none transition-all"
                  value={formData.status}
                  onChange={e => setFormData({...formData, status: e.target.value as any})}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" isLoading={createMutation.isPending || updateMutation.isPending}>Save Cycle</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
