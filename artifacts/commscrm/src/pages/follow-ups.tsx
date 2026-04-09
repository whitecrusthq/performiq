import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPut, apiPost } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  ClipboardList, CalendarClock, CheckCircle2, Search, Plus,
  ArrowRight, Clock, Trash2, AlertCircle, MessageSquare, Mail,
  Phone, Facebook, Instagram, MessageCircle, ChevronDown
} from "lucide-react";
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from "date-fns";
import { getChannelIcon, getChannelColor, getStatusColor } from "@/lib/mock-data";

type FollowUpType = "whatsapp" | "sms" | "email" | "facebook" | "instagram" | "phone";

interface FollowUp {
  id: number;
  channel: string;
  status: string;
  followUpAt: string;
  followUpNote: string | null;
  followUpType: FollowUpType | null;
  lastMessageAt: string | null;
  customer: { id: number; name: string; phone: string | null; channel: string };
  assignedAgent: { id: number; name: string } | null;
}

interface Customer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  channel: string;
}

const FOLLOW_UP_TYPES: { value: FollowUpType; label: string; icon: React.ElementType; color: string }[] = [
  { value: "whatsapp",  label: "WhatsApp",  icon: MessageSquare, color: "text-green-600"  },
  { value: "sms",       label: "SMS",       icon: MessageCircle, color: "text-blue-600"   },
  { value: "email",     label: "Email",     icon: Mail,          color: "text-purple-600" },
  { value: "facebook",  label: "Facebook",  icon: Facebook,      color: "text-blue-500"   },
  { value: "instagram", label: "Instagram", icon: Instagram,     color: "text-pink-600"   },
  { value: "phone",     label: "Phone Call",icon: Phone,         color: "text-orange-600" },
];

function getFollowUpTypeConfig(type: FollowUpType | null) {
  return FOLLOW_UP_TYPES.find((t) => t.value === type) ?? null;
}

function getUrgencyBadge(followUpAt: string) {
  const d = new Date(followUpAt);
  if (isPast(d) && !isToday(d)) return { label: "Overdue",  color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"       };
  if (isToday(d))               return { label: "Today",    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" };
  if (isTomorrow(d))            return { label: "Tomorrow", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" };
  return                               { label: "Upcoming", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"      };
}

export default function FollowUpsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);

  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(() => {
    const d = new Date(Date.now() + 86400000);
    return d.toISOString().slice(0, 16);
  });
  const [noteText, setNoteText] = useState("");
  const [followUpType, setFollowUpType] = useState<FollowUpType>("whatsapp");

  const { data: followUps = [], isLoading } = useQuery<FollowUp[]>({
    queryKey: ["follow-ups"],
    queryFn: () => apiGet("/follow-ups"),
    refetchInterval: 30000,
  });

  const { data: allCustomers = [] } = useQuery<Customer[]>({
    queryKey: ["customers-list"],
    queryFn: async () => {
      const res: any = await apiGet("/customers?limit=500");
      return Array.isArray(res) ? res : (res?.customers ?? []);
    },
    enabled: showAddDialog,
  });

  const filteredCustomers = allCustomers.filter((c) =>
    !customerSearch || c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.email ?? "").toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone ?? "").includes(customerSearch)
  ).slice(0, 8);

  const clearMutation = useMutation({
    mutationFn: (id: number) => apiPut(`/conversations/${id}/follow-up`, { followUpAt: null, followUpNote: null, followUpType: null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["follow-ups"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      toast({ title: "Follow-up cleared" });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: { customerId: number; followUpAt: string; followUpNote: string; followUpType: FollowUpType }) =>
      apiPost("/follow-ups", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["follow-ups"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      toast({ title: "Follow-up scheduled", description: `Scheduled for ${format(new Date(scheduleDate), "MMM d, yyyy 'at' HH:mm")}` });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "Failed to schedule follow-up", variant: "destructive" });
    },
  });

  function handleCloseDialog() {
    setShowAddDialog(false);
    setSelectedCustomer(null);
    setCustomerSearch("");
    setNoteText("");
    setFollowUpType("whatsapp");
    setScheduleDate(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
  }

  function handleSubmit() {
    if (!selectedCustomer) {
      toast({ title: "Please select a customer", variant: "destructive" });
      return;
    }
    if (!scheduleDate) {
      toast({ title: "Please set a date & time", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      customerId: selectedCustomer.id,
      followUpAt: scheduleDate,
      followUpNote: noteText,
      followUpType,
    });
  }

  const filtered = followUps.filter((f) =>
    !search || f.customer.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.followUpNote ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const overdue  = filtered.filter((f) => isPast(new Date(f.followUpAt)) && !isToday(new Date(f.followUpAt)));
  const today    = filtered.filter((f) => isToday(new Date(f.followUpAt)));
  const upcoming = filtered.filter((f) => !isPast(new Date(f.followUpAt)) && !isToday(new Date(f.followUpAt)));

  function renderCard(fu: FollowUp) {
    const Icon = getChannelIcon(fu.channel);
    const urgency = getUrgencyBadge(fu.followUpAt);
    const typeConfig = getFollowUpTypeConfig(fu.followUpType);
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
                {typeConfig && (
                  <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${typeConfig.color}`}>
                    <typeConfig.icon className="h-3 w-3" />
                    {typeConfig.label}
                  </span>
                )}
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Follow-ups</h1>
          <p className="text-muted-foreground text-sm">Track conversations that need follow-up action</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add Follow-up
        </Button>
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

      {/* List */}
      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">Loading follow-ups...</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">No follow-ups scheduled.</p>
          <p className="text-xs text-muted-foreground">Click "Add Follow-up" above or mark conversations from the Inbox ⋮ menu.</p>
          <Button variant="outline" size="sm" className="gap-2 mt-2" onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4" /> Add Follow-up
          </Button>
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

      {/* Add Follow-up Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { if (!open) handleCloseDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Follow-up</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Customer search */}
            <div className="space-y-1.5">
              <Label>Customer <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  className="pl-9 pr-9"
                  placeholder="Search by name, email, or phone..."
                  value={selectedCustomer ? selectedCustomer.name : customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setSelectedCustomer(null);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-2 h-5 w-5 flex items-center justify-center text-primary hover:text-primary/70 transition-colors"
                  onClick={() => setShowCustomerDropdown((prev) => !prev)}
                  tabIndex={-1}
                >
                  <ChevronDown className={`h-4 w-4 transition-transform duration-150 ${showCustomerDropdown ? "rotate-180" : ""}`} />
                </button>
                {showCustomerDropdown && filteredCustomers.length > 0 && !selectedCustomer && (
                  <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredCustomers.map((c) => {
                      const CIcon = getChannelIcon(c.channel);
                      return (
                        <button
                          key={c.id}
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent text-left"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSelectedCustomer(c);
                            setCustomerSearch("");
                            setFollowUpType(c.channel as FollowUpType ?? "whatsapp");
                            setShowCustomerDropdown(false);
                          }}
                        >
                          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{c.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{c.email ?? c.phone ?? "No contact"}</p>
                          </div>
                          <CIcon className={`h-4 w-4 shrink-0 ${getChannelColor(c.channel)}`} />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {selectedCustomer && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/5 border border-primary/20 text-sm">
                  <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
                    {selectedCustomer.name.charAt(0)}
                  </div>
                  <span className="font-medium flex-1">{selectedCustomer.name}</span>
                  <button
                    className="text-muted-foreground hover:text-destructive text-xs"
                    onClick={() => { setSelectedCustomer(null); setCustomerSearch(""); }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* Follow-up type */}
            <div className="space-y-1.5">
              <Label>Follow-up Type</Label>
              <div className="grid grid-cols-3 gap-2">
                {FOLLOW_UP_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setFollowUpType(t.value)}
                    className={`flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                      followUpType === t.value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-primary/40 hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <t.icon className={`h-4 w-4 ${followUpType === t.value ? "text-primary" : t.color}`} />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date & time */}
            <div className="space-y-1.5">
              <Label>Date & Time <span className="text-destructive">*</span></Label>
              <Input
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <Label>Note <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                placeholder="Add a note for this follow-up..."
                rows={3}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Scheduling..." : "Schedule Follow-up"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
