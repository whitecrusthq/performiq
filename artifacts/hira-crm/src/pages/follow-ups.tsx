import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPut } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  ClipboardList, CalendarClock, CheckCircle2, Search, Plus,
  ArrowRight, Clock, Trash2, AlertCircle
} from "lucide-react";
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from "date-fns";
import { getChannelIcon, getChannelColor, getStatusColor } from "@/lib/mock-data";

interface FollowUp {
  id: number;
  channel: string;
  status: string;
  followUpAt: string;
  followUpNote: string | null;
  lastMessageAt: string | null;
  customer: { id: number; name: string; phone: string | null; channel: string };
  assignedAgent: { id: number; name: string } | null;
}

function getUrgencyBadge(followUpAt: string) {
  const d = new Date(followUpAt);
  if (isPast(d) && !isToday(d)) return { label: "Overdue", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
  if (isToday(d)) return { label: "Today", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" };
  if (isTomorrow(d)) return { label: "Tomorrow", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" };
  return { label: "Upcoming", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
}

export default function FollowUpsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
  const [noteText, setNoteText] = useState("");
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);

  const { data: followUps = [], isLoading } = useQuery<FollowUp[]>({
    queryKey: ["follow-ups"],
    queryFn: () => apiGet("/follow-ups"),
    refetchInterval: 30000,
  });

  const clearMutation = useMutation({
    mutationFn: (id: number) => apiPut(`/conversations/${id}/follow-up`, { followUpAt: null, followUpNote: null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["follow-ups"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      toast({ title: "Follow-up cleared" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, followUpAt, followUpNote }: { id: number; followUpAt: string; followUpNote: string }) =>
      apiPut(`/conversations/${id}/follow-up`, { followUpAt, followUpNote }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["follow-ups"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      toast({ title: "Follow-up scheduled" });
      setShowAddDialog(false);
      setNoteText("");
    },
  });

  const filtered = followUps.filter((f) =>
    !search || f.customer.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.followUpNote ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const overdue = filtered.filter((f) => isPast(new Date(f.followUpAt)) && !isToday(new Date(f.followUpAt)));
  const today = filtered.filter((f) => isToday(new Date(f.followUpAt)));
  const upcoming = filtered.filter((f) => !isPast(new Date(f.followUpAt)) && !isToday(new Date(f.followUpAt)));

  function renderCard(fu: FollowUp) {
    const Icon = getChannelIcon(fu.channel);
    const urgency = getUrgencyBadge(fu.followUpAt);
    return (
      <Card key={fu.id} className="shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground shrink-0">
              {fu.customer.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-semibold text-sm">{fu.customer.name}</span>
                <Icon className={`h-3.5 w-3.5 ${getChannelColor(fu.channel)}`} />
                <Badge className={`text-[10px] px-1.5 py-0 h-4 ${urgency.color}`}>{urgency.label}</Badge>
                <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-4 ${getStatusColor(fu.status)}`}>{fu.status}</Badge>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                <span>{format(new Date(fu.followUpAt), "MMM d, yyyy 'at' HH:mm")}</span>
                <span className="text-muted-foreground/60">· {formatDistanceToNow(new Date(fu.followUpAt), { addSuffix: true })}</span>
              </div>
              {fu.followUpNote && (
                <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-1.5 mt-1.5 border-l-2 border-primary/30">
                  {fu.followUpNote}
                </p>
              )}
              {fu.assignedAgent && (
                <p className="text-xs text-muted-foreground mt-1.5">Assigned to {fu.assignedAgent.name}</p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => navigate("/inbox")}
              >
                <ArrowRight className="h-3.5 w-3.5" /> Open
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => clearMutation.mutate(fu.id)}
                disabled={clearMutation.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Follow-ups</h1>
          <p className="text-muted-foreground text-sm">Track conversations that need follow-up action</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-3xl font-bold text-red-500">{overdue.length}</p>
              </div>
              <AlertCircle className="h-6 w-6 text-red-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Due Today</p>
                <p className="text-3xl font-bold text-orange-500">{today.length}</p>
              </div>
              <Clock className="h-6 w-6 text-orange-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Upcoming</p>
                <p className="text-3xl font-bold text-blue-500">{upcoming.length}</p>
              </div>
              <CalendarClock className="h-6 w-6 text-blue-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by customer or note..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">Loading follow-ups...</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">No follow-ups scheduled.</p>
          <p className="text-xs text-muted-foreground">Mark conversations for follow-up from the Inbox using the ⋮ menu.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {overdue.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> Overdue ({overdue.length})
              </h3>
              {overdue.map(renderCard)}
            </div>
          )}
          {today.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-2">
                <Clock className="h-4 w-4" /> Today ({today.length})
              </h3>
              {today.map(renderCard)}
            </div>
          )}
          {upcoming.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                <CalendarClock className="h-4 w-4" /> Upcoming ({upcoming.length})
              </h3>
              {upcoming.map(renderCard)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
