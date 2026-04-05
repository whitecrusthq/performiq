import React, { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getChannelIcon, getChannelColor, getStatusColor } from "@/lib/mock-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Search, MoreVertical, Send, CheckCircle, Paperclip, Smile,
  UserPlus, MessageSquare, Loader2, Sparkles, Bot, Zap, RefreshCw,
  ChevronUp, Lock, AlertTriangle, Archive, Clock, CalendarClock, ListOrdered,
  BrainCircuit, X, BookOpen, CornerDownLeft
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";

interface ApiAgent { id: number; name: string; avatar: string | null; email: string; role: string; }
interface ApiCustomer { id: number; name: string; phone: string | null; channel: string; }
interface ApiConversation {
  id: number;
  channel: "whatsapp" | "facebook" | "instagram";
  status: "open" | "ongoing" | "pending" | "resolved";
  unreadCount: number;
  lastMessageAt: string | null;
  customer: ApiCustomer;
  assignedAgent: ApiAgent | null;
  isLocked: boolean;
  lockedByAgent: { id: number; name: string } | null;
  lockedByAgentId: number | null;
  lastMessage: { content: string; sender: "customer" | "agent" | "bot" } | null;
  followUpAt: string | null;
  followUpNote: string | null;
}
interface ApiMessage { id: number; sender: "customer" | "agent" | "bot"; content: string; isRead: boolean; createdAt: string; }
interface ConversationListResponse { total: number; conversations: ApiConversation[]; }
interface AiSuggestResponse { suggestions: string[]; }

interface ClosedConversation {
  id: number;
  originalId: number;
  customerName: string;
  customerPhone: string | null;
  channel: "whatsapp" | "facebook" | "instagram";
  assignedAgentName: string | null;
  closedByAgentName: string | null;
  messageCount: number;
  closedAt: string;
  originalCreatedAt: string;
}
interface ClosedConversationListResponse { total: number; conversations: ClosedConversation[]; }
interface ClosedMessage { id: number; sender: "customer" | "agent" | "bot"; content: string; originalCreatedAt: string; }

type InboxTab = "queue" | "active" | "closed";

export default function Inbox() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { agent } = useAuth();
  const [tab, setTab] = useState<InboxTab>("queue");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedClosedId, setSelectedClosedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [replyText, setReplyText] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isAutoResponding, setIsAutoResponding] = useState(false);
  const [lockConflict, setLockConflict] = useState<{ name: string } | null>(null);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false);
  const [followUpDate, setFollowUpDate] = useState(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
  const [followUpNote, setFollowUpNote] = useState("");
  const [showAssistPanel, setShowAssistPanel] = useState(false);
  const [assistQuestion, setAssistQuestion] = useState("");
  const [assistLoading, setAssistLoading] = useState(false);
  const [assistMessages, setAssistMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const assistEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const convParams = new URLSearchParams();
  if (tab === "queue") {
    convParams.set("status", "open,ongoing,pending");
  } else if (filter !== "all") {
    convParams.set("status", filter);
  }
  if (channelFilter !== "all") convParams.set("channel", channelFilter);
  if (searchQuery) convParams.set("search", searchQuery);
  convParams.set("limit", "50");

  const { data: convData, isLoading: convLoading } = useQuery<ConversationListResponse>({
    queryKey: ["conversations", tab, filter, channelFilter, searchQuery],
    queryFn: () => apiGet(`/conversations?${convParams.toString()}`),
    refetchInterval: 5000,
    enabled: tab === "active" || tab === "queue",
  });

  const closedParams = new URLSearchParams();
  if (searchQuery) closedParams.set("search", searchQuery);
  closedParams.set("limit", "50");

  const { data: closedData, isLoading: closedLoading } = useQuery<ClosedConversationListResponse>({
    queryKey: ["closed-conversations", searchQuery],
    queryFn: () => apiGet(`/closed-conversations?${closedParams.toString()}`),
    refetchInterval: 15000,
    enabled: tab === "closed",
  });

  const conversations = convData?.conversations ?? [];
  const closedConversations = closedData?.conversations ?? [];

  const { data: messages = [], isLoading: messagesLoading } = useQuery<ApiMessage[]>({
    queryKey: ["messages", selectedId],
    queryFn: () => apiGet(`/conversations/${selectedId}/messages`),
    enabled: !!selectedId,
    refetchInterval: 4000,
  });

  const { data: closedMessages = [], isLoading: closedMessagesLoading } = useQuery<ClosedMessage[]>({
    queryKey: ["closed-messages", selectedClosedId],
    queryFn: () => apiGet(`/closed-conversations/${selectedClosedId}/messages`),
    enabled: !!selectedClosedId,
  });

  const { data: agentsList = [] } = useQuery<ApiAgent[]>({
    queryKey: ["agents"],
    queryFn: () => apiGet("/agents"),
  });

  const claimConversation = useCallback(async (id: number, force = false) => {
    try {
      const endpoint = force ? `/conversations/${id}/force-claim` : `/conversations/${id}/claim`;
      await apiPost(endpoint, {});
    } catch (err: unknown) {
      const error = err as { message?: string };
      if (!force && error?.message?.includes("conversation_locked")) {
        const match = error.message.match(/by (.+)\./);
        const name = match?.[1] ?? "another agent";
        setLockConflict({ name });
        return false;
      }
    }
    return true;
  }, []);

  const releaseConversation = useCallback(async (id: number) => {
    try {
      await apiPost(`/conversations/${id}/release`, {});
    } catch {}
  }, []);

  useEffect(() => {
    if (conversations.length > 0 && !selectedId && (tab === "active" || tab === "queue")) {
      const firstUnlocked = conversations.find((c) => !c.isLocked || c.lockedByAgentId === agent?.id);
      setSelectedId(firstUnlocked?.id ?? conversations[0].id);
    }
  }, [conversations, selectedId, tab, agent?.id]);

  useEffect(() => {
    if (closedConversations.length > 0 && !selectedClosedId && tab === "closed") {
      setSelectedClosedId(closedConversations[0].id);
    }
  }, [closedConversations, selectedClosedId, tab]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, closedMessages]);

  useEffect(() => {
    setAiSuggestions([]);
    setShowSuggestions(false);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    claimConversation(selectedId);
    return () => {
      releaseConversation(selectedId);
    };
  }, [selectedId, claimConversation, releaseConversation]);

  const sendMessageMutation = useMutation({
    mutationFn: ({ content }: { content: string }) =>
      apiPost(`/conversations/${selectedId}/messages`, { content, sender: "agent" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", selectedId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const updateConvMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number; status?: string; assignedAgentId?: number | null }) =>
      apiPut(`/conversations/${id}`, data),
    onSuccess: (result: unknown) => {
      const r = result as { archived?: boolean };
      if (r?.archived) {
        setSelectedId(null);
        toast({ title: "Conversation closed", description: "Moved to the Closed tab." });
      }
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["closed-conversations"] });
    },
  });

  const followUpMutation = useMutation({
    mutationFn: ({ id, followUpAt, followUpNote }: { id: number; followUpAt: string | null; followUpNote: string | null }) =>
      apiPut(`/conversations/${id}/follow-up`, { followUpAt, followUpNote }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["follow-ups"] });
      toast({ title: "Follow-up scheduled", description: "This conversation has been marked for follow-up." });
      setShowFollowUpDialog(false);
      setFollowUpNote("");
    },
    onError: () => toast({ title: "Failed to schedule follow-up", variant: "destructive" }),
  });

  const handleSend = () => {
    if (!replyText.trim() || !selectedId) return;
    sendMessageMutation.mutate({ content: replyText });
    setReplyText("");
    setShowSuggestions(false);
  };

  const handleGetSuggestions = async () => {
    if (!selectedId) return;
    setIsLoadingSuggestions(true);
    setShowSuggestions(true);
    try {
      const data: AiSuggestResponse = await apiPost("/ai/suggest-reply", { conversationId: selectedId });
      setAiSuggestions(data.suggestions || []);
    } catch {
      toast({ title: "AI unavailable", description: "Could not load suggestions.", variant: "destructive" });
      setShowSuggestions(false);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleAutoRespond = async () => {
    if (!selectedId) return;
    setIsAutoResponding(true);
    try {
      await apiPost("/ai/auto-respond", { conversationId: selectedId });
      qc.invalidateQueries({ queryKey: ["messages", selectedId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      toast({ title: "CommsBot responded", description: "AI sent an automated reply." });
    } catch {
      toast({ title: "Auto-respond failed", variant: "destructive" });
    } finally {
      setIsAutoResponding(false);
    }
  };

  const handleAgentAssist = async (question?: string) => {
    const q = (question ?? assistQuestion).trim();
    if (!q) return;
    setAssistQuestion("");
    setAssistMessages((prev) => [...prev, { role: "user", content: q }]);
    setAssistLoading(true);
    try {
      const data: { answer: string } = await apiPost("/ai/agent-assist", { question: q, conversationId: selectedId ?? undefined });
      setAssistMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
    } catch {
      setAssistMessages((prev) => [...prev, { role: "assistant", content: "Unable to get an answer. Please check that an AI provider is configured in Settings." }]);
    } finally {
      setAssistLoading(false);
    }
  };

  useEffect(() => {
    assistEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [assistMessages, assistLoading]);

  const handleCloseConversation = () => {
    if (!selectedId) return;
    updateConvMutation.mutate({ id: selectedId, status: "closed" });
    setShowCloseDialog(false);
  };

  const handleSelectConversation = async (id: number) => {
    if (selectedId === id) return;
    if (selectedId) await releaseConversation(selectedId);
    const claimed = await claimConversation(id);
    if (claimed !== false) {
      setSelectedId(id);
      setReplyText("");
    }
  };

  const handleForceClaim = async () => {
    if (!lockConflict || !selectedId) return;
    setLockConflict(null);
    await claimConversation(selectedId, true);
    qc.invalidateQueries({ queryKey: ["conversations"] });
  };

  const selectedConv = conversations.find((c) => c.id === selectedId) ?? null;
  const selectedClosed = closedConversations.find((c) => c.id === selectedClosedId) ?? null;
  const isLockedByOther = selectedConv?.isLocked && selectedConv.lockedByAgentId !== agent?.id;

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* Left Panel — Slack-style dark sidebar */}
      <div className="w-[300px] flex flex-col shrink-0" style={{ backgroundColor: '#3F0E40' }}>

        {/* Sidebar header */}
        <div className="px-4 pt-4 pb-3 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-[15px] leading-tight">CommsCRM</span>
              <span className="text-white/40 text-xs">▾</span>
            </div>
            <Tabs value={tab} onValueChange={(v) => { setTab(v as InboxTab); setSelectedId(null); setSelectedClosedId(null); setChannelFilter("all"); setFilter("all"); }}>
              <TabsList className="h-6 bg-white/15 gap-0 p-0.5">
                <TabsTrigger value="queue" className="text-[11px] h-5 px-2 text-white/70 data-[state=active]:bg-white/20 data-[state=active]:text-white rounded gap-1">
                  <ListOrdered className="h-2.5 w-2.5" /> Queue
                </TabsTrigger>
                <TabsTrigger value="active" className="text-[11px] h-5 px-2 text-white/70 data-[state=active]:bg-white/20 data-[state=active]:text-white rounded">All</TabsTrigger>
                <TabsTrigger value="closed" className="text-[11px] h-5 px-2 text-white/70 data-[state=active]:bg-white/20 data-[state=active]:text-white rounded gap-1">
                  <Archive className="h-2.5 w-2.5" /> Closed
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-white/50" />
            <input
              placeholder="Search conversations…"
              className="w-full bg-white/10 text-white placeholder-white/40 text-xs rounded-md pl-8 pr-3 py-1.5 border border-white/10 outline-none focus:bg-white/20 focus:border-white/20 transition-colors"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-inbox"
            />
          </div>
        </div>

        {/* Channel filter + status filter */}
        {(tab === "active" || tab === "queue") && (() => {
          const WhatsAppIcon = getChannelIcon("whatsapp");
          const FacebookIcon = getChannelIcon("facebook");
          const InstagramIcon = getChannelIcon("instagram");
          const channels = [
            { key: "all", label: "All" },
            { key: "whatsapp", label: "WA", icon: WhatsAppIcon },
            { key: "facebook", label: "FB", icon: FacebookIcon },
            { key: "instagram", label: "IG", icon: InstagramIcon },
          ];
          return (
            <div className="px-3 pt-3 pb-2 flex items-center gap-1.5 flex-wrap">
              {channels.map((ch) => (
                <button
                  key={ch.key}
                  onClick={() => setChannelFilter(ch.key)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    channelFilter === ch.key
                      ? "bg-white/25 text-white"
                      : "text-white/50 hover:bg-white/10 hover:text-white/80"
                  }`}
                >
                  {ch.icon ? <ch.icon className="h-2.5 w-2.5" /> : null}
                  {ch.label}
                </button>
              ))}
              {tab === "active" && (
                <div className="ml-auto">
                  <Select value={filter} onValueChange={setFilter}>
                    <SelectTrigger className="h-5 text-[11px] bg-transparent border-white/20 text-white/60 w-[80px] focus:ring-0 px-2" data-testid="select-filter-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          );
        })()}

        {/* Section label */}
        <div className="px-4 pt-2 pb-1 flex items-center justify-between">
          <span className="text-white/40 text-[11px] font-semibold uppercase tracking-wider">
            {tab === "queue" ? "Needs Attention" : tab === "active" ? "All Conversations" : "Archived"}
          </span>
          {tab === "queue" && conversations.length > 0 && (
            <span className="text-[10px] font-bold bg-white/20 text-white/80 rounded-full px-1.5 py-0.5 leading-none">
              {conversations.length}
            </span>
          )}
        </div>

        <ScrollArea className="flex-1">
          {/* Queue Tab — grouped by Open / Pending */}
          {tab === "queue" && (
            <>
              {convLoading && <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-white/40" /></div>}
              {!convLoading && conversations.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <div className="text-white/20 text-3xl mb-2">✓</div>
                  <p className="text-white/40 text-xs font-medium">Queue is clear!</p>
                  <p className="text-white/25 text-[11px] mt-1">No open, engaged, or pending chats.</p>
                </div>
              )}
              {["open", "ongoing", "pending"].map((status) => {
                const group = conversations.filter((c) => c.status === status);
                if (group.length === 0) return null;
                const groupLabel = status === "open" ? "🔴 New / Open" : status === "ongoing" ? "🟢 Ongoing" : "🟡 Pending";
                const groupColor = status === "open" ? "text-red-300/70" : status === "ongoing" ? "text-emerald-300/70" : "text-yellow-300/70";
                return (
                  <div key={status}>
                    <div className={`px-4 pt-3 pb-1 flex items-center gap-2`}>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${groupColor}`}>{groupLabel}</span>
                      <span className={`text-[10px] font-bold bg-white/10 rounded-full px-1.5 py-0.5 leading-none ${groupColor}`}>{group.length}</span>
                    </div>
                    {group.map((conv) => {
                      const Icon = getChannelIcon(conv.channel);
                      const isSelected = conv.id === selectedId;
                      const lockedByOther = conv.isLocked && conv.lockedByAgentId !== agent?.id;
                      const hasUnread = conv.unreadCount > 0;
                      const isLive = (conv.status === "open" || conv.status === "ongoing") && hasUnread;
                      const lastMsgPreview = conv.lastMessage
                        ? (conv.lastMessage.sender === "agent" ? `You: ${conv.lastMessage.content}` : conv.lastMessage.sender === "bot" ? `🤖 ${conv.lastMessage.content}` : conv.lastMessage.content)
                        : conv.customer.phone ?? "—";
                      return (
                        <div
                          key={conv.id}
                          onClick={() => handleSelectConversation(conv.id)}
                          className={`mx-2 mb-0.5 px-2.5 py-2 rounded-md cursor-pointer transition-colors flex items-center gap-2.5 group ${
                            isSelected ? 'bg-white/20' : 'hover:bg-white/10'
                          }`}
                          data-testid={`conversation-item-${conv.id}`}
                        >
                          <div className="relative shrink-0">
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                              conv.status === "open" ? "bg-red-500/60" : conv.status === "ongoing" ? "bg-emerald-500/60" : "bg-yellow-500/60"
                            }`}>
                              {conv.customer.name.charAt(0).toUpperCase()}
                            </div>
                            {isLive && !lockedByOther ? (
                              <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-400 border-2 border-[#3F0E40]" />
                              </span>
                            ) : (
                              <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#3F0E40] ${conv.status === "open" ? "bg-red-400/60" : conv.status === "ongoing" ? "bg-emerald-400/60" : "bg-yellow-400/60"}`} />
                            )}
                            {lockedByOther && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 flex items-center justify-center rounded-full bg-amber-400">
                                    <Lock className="h-2 w-2 text-white" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>{conv.lockedByAgent?.name} is handling this</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className={`text-[13px] truncate leading-none ${hasUnread ? 'text-white font-bold' : 'text-white/70 font-medium'}`}>
                                {conv.customer.name}
                              </span>
                              <span className={`text-[11px] shrink-0 leading-none ${hasUnread ? 'text-white/80' : 'text-white/35'}`}>
                                {conv.lastMessageAt ? format(new Date(conv.lastMessageAt), "HH:mm") : ""}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-1 mt-0.5">
                              <span className={`text-[12px] truncate leading-none ${hasUnread ? 'text-white/80' : 'text-white/45'}`}>
                                <Icon className={`h-2.5 w-2.5 inline mr-0.5 ${getChannelColor(conv.channel)}`} />
                                {lockedByOther
                                  ? <span className="text-amber-300"><Lock className="h-2.5 w-2.5 inline" /> {conv.lockedByAgent?.name}</span>
                                  : lastMsgPreview
                                }
                              </span>
                              {hasUnread && (
                                <span className={`shrink-0 h-4 min-w-[16px] rounded-full bg-white text-[#3F0E40] text-[10px] font-bold flex items-center justify-center px-1 ${isLive ? 'animate-pulse' : ''}`}>
                                  {conv.unreadCount}
                                </span>
                              )}
                            </div>
                            {conv.followUpAt && (
                              <span className="flex items-center gap-0.5 text-[10px] text-amber-300 mt-0.5">
                                <CalendarClock className="h-2.5 w-2.5" />
                                {format(new Date(conv.followUpAt), "MMM d")}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}

          {/* All Conversations Tab */}
          {tab === "active" && (
            <>
              {convLoading && <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-white/40" /></div>}
              {conversations.map((conv) => {
                const Icon = getChannelIcon(conv.channel);
                const isSelected = conv.id === selectedId;
                const lockedByOther = conv.isLocked && conv.lockedByAgentId !== agent?.id;
                const hasUnread = conv.unreadCount > 0;
                const isLive = conv.status === "open" && hasUnread;
                const lastMsgPreview = conv.lastMessage
                  ? (conv.lastMessage.sender === "agent" ? `You: ${conv.lastMessage.content}` : conv.lastMessage.sender === "bot" ? `🤖 ${conv.lastMessage.content}` : conv.lastMessage.content)
                  : conv.customer.phone ?? "—";

                return (
                  <div
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv.id)}
                    className={`mx-2 mb-0.5 px-2.5 py-2 rounded-md cursor-pointer transition-colors flex items-center gap-2.5 group ${
                      isSelected ? 'bg-white/20' : 'hover:bg-white/10'
                    }`}
                    data-testid={`conversation-item-${conv.id}`}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                        isSelected ? 'bg-white/30' : 'bg-white/20'
                      }`}>
                        {conv.customer.name.charAt(0).toUpperCase()}
                      </div>
                      {/* Online status dot */}
                      {isLive && !lockedByOther ? (
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-400 border-2 border-[#3F0E40]" />
                        </span>
                      ) : (
                        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#3F0E40] bg-white/20" />
                      )}
                      {lockedByOther && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 flex items-center justify-center rounded-full bg-amber-400">
                              <Lock className="h-2 w-2 text-white" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{conv.lockedByAgent?.name} is handling this</TooltipContent>
                        </Tooltip>
                      )}
                    </div>

                    {/* Text content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-[13px] truncate leading-none ${hasUnread ? 'text-white font-bold' : 'text-white/70 font-medium'}`}>
                          {conv.customer.name}
                        </span>
                        <span className={`text-[11px] shrink-0 leading-none ${hasUnread ? 'text-white/80' : 'text-white/35'}`}>
                          {conv.lastMessageAt ? format(new Date(conv.lastMessageAt), "HH:mm") : ""}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-1 mt-0.5">
                        <span className={`text-[12px] truncate leading-none ${hasUnread ? 'text-white/80' : 'text-white/45'}`}>
                          {lockedByOther
                            ? <span className="text-amber-300 flex items-center gap-1"><Lock className="h-2.5 w-2.5 inline" /> {conv.lockedByAgent?.name}</span>
                            : <>
                                <Icon className={`h-2.5 w-2.5 inline mr-0.5 ${getChannelColor(conv.channel)}`} />
                                {lastMsgPreview}
                              </>
                          }
                        </span>
                        {hasUnread && (
                          <span className={`shrink-0 h-4 min-w-[16px] rounded-full bg-white text-[#3F0E40] text-[10px] font-bold flex items-center justify-center px-1 ${isLive ? 'animate-pulse' : ''}`}>
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                      {conv.followUpAt && (
                        <span className="flex items-center gap-0.5 text-[10px] text-amber-300 mt-0.5">
                          <CalendarClock className="h-2.5 w-2.5" />
                          {format(new Date(conv.followUpAt), "MMM d")}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {!convLoading && conversations.length === 0 && (
                <div className="p-8 text-center text-white/35 text-sm">No active conversations.</div>
              )}
            </>
          )}

          {/* Closed Conversations */}
          {tab === "closed" && (
            <>
              {closedLoading && <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-white/40" /></div>}
              {closedConversations.map((conv) => {
                const Icon = getChannelIcon(conv.channel);
                const isSelected = conv.id === selectedClosedId;
                return (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedClosedId(conv.id)}
                    className={`mx-2 mb-0.5 px-2.5 py-2 rounded-md cursor-pointer transition-colors flex items-center gap-2.5 ${
                      isSelected ? 'bg-white/20' : 'hover:bg-white/10'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold text-white bg-white/15">
                        {conv.customerName.charAt(0).toUpperCase()}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#3F0E40] bg-white/15" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[13px] text-white/50 font-medium truncate leading-none">{conv.customerName}</span>
                        <span className="text-[11px] text-white/30 shrink-0 leading-none">
                          {formatDistanceToNow(new Date(conv.closedAt), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Icon className={`h-2.5 w-2.5 ${getChannelColor(conv.channel)} opacity-60`} />
                        <span className="text-[11px] text-white/35">{conv.messageCount} messages · Archived</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!closedLoading && closedConversations.length === 0 && (
                <div className="p-8 text-center text-white/35 text-sm">No closed conversations yet.</div>
              )}
            </>
          )}
        </ScrollArea>

        {/* Bottom: agent info */}
        <div className="px-3 py-3 border-t border-white/10 flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold text-white shrink-0">
            {agent?.name?.charAt(0) ?? "A"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-[13px] font-semibold leading-none truncate">{agent?.name ?? "Agent"}</p>
            <p className="text-white/45 text-[11px] mt-0.5 truncate">{agent?.role ?? "agent"}</p>
          </div>
          <span className="h-2.5 w-2.5 rounded-full bg-green-400 shrink-0" />
        </div>
      </div>

      {/* Right Panel */}
      {(tab === "active" || tab === "queue") && selectedConv ? (
        <div className="flex-1 flex min-w-0 overflow-hidden">
        <div className="flex-1 flex flex-col bg-background min-w-0 overflow-hidden">
          {/* Lock Conflict Warning */}
          {lockConflict && (
            <Alert className="m-4 mb-0 border-amber-200 bg-amber-50 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="flex items-center justify-between">
                <span className="text-sm text-amber-700 dark:text-amber-400">
                  <strong>{lockConflict.name}</strong> is currently handling this conversation.
                </span>
                <div className="flex gap-2 ml-4 shrink-0">
                  <Button size="sm" variant="outline" className="h-7 text-xs border-amber-300" onClick={() => setLockConflict(null)}>
                    Go back
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs text-amber-700 border-amber-300 hover:bg-amber-100" onClick={handleForceClaim}>
                    Take over anyway
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Agent lock notice for the active conversation */}
          {isLockedByOther && !lockConflict && (
            <div className="mx-4 mt-4 px-4 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
              <Lock className="h-4 w-4 shrink-0" />
              <span>This conversation is being handled by <strong>{selectedConv.lockedByAgent?.name}</strong></span>
            </div>
          )}

          {/* Chat Header — Slack style */}
          <div className="h-14 border-b flex items-center justify-between px-4 bg-background shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <div className="font-bold text-[15px] flex items-center gap-1.5 leading-tight">
                  {selectedConv.customer.name}
                  {React.createElement(getChannelIcon(selectedConv.channel), { className: `h-3.5 w-3.5 ${getChannelColor(selectedConv.channel)}` })}
                </div>
                <div className="text-xs text-muted-foreground leading-tight flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0 rounded text-[10px] font-medium ${getStatusColor(selectedConv.status)}`}>{selectedConv.status}</span>
                  {selectedConv.customer.phone && <span>{selectedConv.customer.phone}</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAutoRespond}
                    disabled={isAutoResponding || !!isLockedByOther}
                    className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-900 dark:hover:bg-blue-950"
                    data-testid="button-auto-respond"
                  >
                    {isAutoResponding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                    Bot Reply
                  </Button>
                </TooltipTrigger>
                <TooltipContent>CommsBot auto-responds to customer</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showAssistPanel ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowAssistPanel((v) => !v)}
                    className={showAssistPanel ? "gap-2 bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600" : "gap-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-900 dark:hover:bg-emerald-950"}
                    data-testid="button-ai-assist"
                  >
                    <BrainCircuit className="h-4 w-4" />
                    AI Assist
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Ask AI about SOPs, FAQs & company knowledge</TooltipContent>
              </Tooltip>

              <Select
                value={selectedConv.assignedAgent?.id.toString() ?? "unassigned"}
                onValueChange={(val) => updateConvMutation.mutate({ id: selectedConv.id, assignedAgentId: val === "unassigned" ? null : parseInt(val) })}
              >
                <SelectTrigger className="w-[150px] h-9" data-testid="select-assign-agent">
                  <div className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate text-sm">{selectedConv.assignedAgent?.name ?? "Unassigned"}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {agentsList.map((a) => (
                    <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedConv.status}
                onValueChange={(val) => updateConvMutation.mutate({ id: selectedConv.id, status: val })}
              >
                <SelectTrigger className={`w-[120px] h-9 ${getStatusColor(selectedConv.status)} border-none`} data-testid="select-change-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid="button-chat-options">
                    <MoreVertical className="h-5 w-5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>View Customer Profile</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      setFollowUpDate(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
                      setFollowUpNote(selectedConv?.followUpNote ?? "");
                      setShowFollowUpDialog(true);
                    }}
                    data-testid="menu-item-follow-up"
                  >
                    <CalendarClock className="h-4 w-4 mr-2 text-orange-500" />
                    {selectedConv?.followUpAt ? "Update Follow-up" : "Schedule Follow-up"}
                  </DropdownMenuItem>
                  {selectedConv?.followUpAt && (
                    <DropdownMenuItem
                      onClick={() => followUpMutation.mutate({ id: selectedConv.id, followUpAt: null, followUpNote: null })}
                    >
                      <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                      Clear Follow-up
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setShowCloseDialog(true)}
                    data-testid="menu-item-close-conversation"
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    Close & Archive Conversation
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Messages — Slack flat style */}
          <div className="flex-1 overflow-y-auto bg-background" ref={scrollRef}>
            {messagesLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
            <div className="pt-4 pb-2">
              {messages.map((msg, i) => {
                const isMe = msg.sender === 'agent';
                const isBot = msg.sender === 'bot';
                const isCustomer = msg.sender === 'customer';
                const showDateDivider = i === 0 || new Date(messages[i - 1].createdAt).toDateString() !== new Date(msg.createdAt).toDateString();
                const prevSameSender = i > 0 && messages[i - 1].sender === msg.sender;
                const senderName = isMe ? (agent?.name ?? "Agent") : isBot ? "CommsBot" : selectedConv.customer.name;
                const avatarColor = isMe ? "bg-violet-600" : isBot ? "bg-blue-500" : "bg-emerald-600";
                const avatarLetter = isMe ? (agent?.name?.charAt(0) ?? "A") : isBot ? "🤖" : selectedConv.customer.name.charAt(0);

                return (
                  <React.Fragment key={msg.id}>
                    {showDateDivider && (
                      <div className="flex items-center gap-3 mx-4 my-4">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs text-muted-foreground font-medium px-2">
                          {format(new Date(msg.createdAt), "MMMM d, yyyy")}
                        </span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                    )}
                    <div
                      className={`group flex items-start gap-3 px-4 py-0.5 hover:bg-muted/30 transition-colors rounded-sm ${prevSameSender && !showDateDivider ? 'mt-0' : 'mt-3'}`}
                    >
                      {/* Avatar column — always left */}
                      <div className="shrink-0 w-9 mt-0.5">
                        {!prevSameSender || showDateDivider ? (
                          isBot ? (
                            <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${avatarColor}`}>
                              <Bot className="h-5 w-5 text-white" />
                            </div>
                          ) : (
                            <div className={`h-9 w-9 rounded-lg flex items-center justify-center text-sm font-bold text-white ${avatarColor}`}>
                              {avatarLetter}
                            </div>
                          )
                        ) : (
                          <span className="text-[10px] text-muted-foreground/0 group-hover:text-muted-foreground/60 leading-9 block text-right select-none transition-colors">
                            {format(new Date(msg.createdAt), "HH:mm")}
                          </span>
                        )}
                      </div>

                      {/* Message body */}
                      <div className="flex-1 min-w-0">
                        {(!prevSameSender || showDateDivider) && (
                          <div className="flex items-baseline gap-2 mb-0.5">
                            <span className={`text-sm font-bold leading-none ${isMe ? 'text-violet-700 dark:text-violet-400' : isBot ? 'text-blue-600 dark:text-blue-400' : 'text-foreground'}`}>
                              {senderName}
                            </span>
                            {isBot && <span className="text-[10px] text-white bg-blue-500 rounded px-1 py-0 font-medium">APP</span>}
                            {isMe && <span className="text-[10px] text-white bg-violet-500 rounded px-1 py-0 font-medium">Agent</span>}
                            <span className="text-[11px] text-muted-foreground leading-none">{format(new Date(msg.createdAt), "h:mm a")}</span>
                          </div>
                        )}
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
            {!messagesLoading && messages.length === 0 && (
              <div className="flex justify-center items-center py-16 text-muted-foreground text-sm">
                <div className="text-center space-y-2">
                  <MessageSquare className="h-10 w-10 mx-auto opacity-20" />
                  <p className="font-medium">This is the beginning of your conversation with <strong>{selectedConv.customer.name}</strong></p>
                </div>
              </div>
            )}
          </div>

          {/* AI Suggestions Panel */}
          {showSuggestions && (
            <div className="border-t bg-violet-50/80 dark:bg-violet-950/20 px-4 py-2.5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-violet-400">
                  <Sparkles className="h-3.5 w-3.5" /> AI Suggestions
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={handleGetSuggestions} disabled={isLoadingSuggestions} className="h-5 px-2 text-xs text-violet-600">
                    <RefreshCw className={`h-3 w-3 mr-1 ${isLoadingSuggestions ? 'animate-spin' : ''}`} /> Refresh
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowSuggestions(false)} className="h-5 px-2 text-xs">
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {isLoadingSuggestions ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Generating…
                </div>
              ) : (
                <div className="space-y-1">
                  {aiSuggestions.map((s, i) => (
                    <button key={i} onClick={() => { setReplyText(s); setShowSuggestions(false); }}
                      className="w-full text-left text-xs px-2.5 py-1.5 rounded-md bg-white dark:bg-white/10 hover:bg-violet-100 dark:hover:bg-violet-900/30 border border-violet-200/80 dark:border-violet-800/50 transition-colors text-foreground">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Reply Box — Slack style */}
          <div className="px-4 py-3 bg-background shrink-0">
            {isLockedByOther ? (
              <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground bg-muted/40 rounded-lg border">
                <Lock className="h-4 w-4" />
                <span>Read-only — <strong>{selectedConv.lockedByAgent?.name}</strong> is handling this</span>
              </div>
            ) : (
              <div className="rounded-lg border border-input bg-background focus-within:ring-1 focus-within:ring-ring/50 transition-all">
                {/* Toolbar row */}
                <div className="flex items-center gap-0.5 px-2 pt-2 pb-1 border-b border-border/40">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground rounded">
                    <Paperclip className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground rounded">
                    <Smile className="h-3.5 w-3.5" />
                  </Button>
                  <div className="w-px h-4 bg-border/60 mx-1" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={handleGetSuggestions} disabled={isLoadingSuggestions}
                        className="h-7 w-7 text-violet-500 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950 rounded" data-testid="button-ai-suggest">
                        {isLoadingSuggestions ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>AI reply suggestions</TooltipContent>
                  </Tooltip>
                </div>

                {/* Text input row */}
                <div className="flex items-end gap-2 px-3 py-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder={`Message ${selectedConv.customer.name}…`}
                    className="flex-1 bg-transparent border-none resize-none outline-none max-h-32 min-h-[36px] py-1 text-sm leading-relaxed"
                    rows={1}
                    data-testid="textarea-reply"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!replyText.trim() || sendMessageMutation.isPending}
                    size="icon"
                    className="h-8 w-8 rounded-md shrink-0 mb-0.5"
                    data-testid="button-send-reply"
                  >
                    {sendMessageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* AI Assist Side Panel */}
        {showAssistPanel && (
          <div className="w-80 border-l flex flex-col bg-background shrink-0">
            {/* Panel header */}
            <div className="h-14 border-b flex items-center justify-between px-4 shrink-0 bg-emerald-50/60 dark:bg-emerald-950/20">
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-emerald-600" />
                <span className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">AI Assist</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 font-medium">Knowledge Base</span>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setShowAssistPanel(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {assistMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-6">
                  <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <BookOpen className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Your Knowledge Guide</p>
                    <p className="text-xs text-muted-foreground mt-1">Ask anything about company policies, SOPs, FAQs, or procedures.</p>
                  </div>
                  <div className="w-full space-y-1.5 mt-2">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Quick questions</p>
                    {[
                      "What is our refund policy?",
                      "How do I escalate a complaint?",
                      "What are our SLA response times?",
                      "How to handle an angry customer?",
                      "What are the steps to verify identity?",
                    ].map((q) => (
                      <button
                        key={q}
                        onClick={() => handleAgentAssist(q)}
                        className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors text-foreground/80 hover:text-foreground"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {assistMessages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 mt-0.5">
                      <BrainCircuit className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words ${
                    msg.role === "user"
                      ? "bg-emerald-600 text-white rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}

              {assistLoading && (
                <div className="flex gap-2 justify-start">
                  <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 mt-0.5">
                    <BrainCircuit className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <div className="bg-muted rounded-xl rounded-bl-sm px-3 py-2">
                    <div className="flex gap-1 items-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={assistEndRef} />
            </div>

            {/* Input area */}
            <div className="p-3 border-t shrink-0">
              {assistMessages.length > 0 && (
                <button
                  onClick={() => setAssistMessages([])}
                  className="w-full text-[11px] text-muted-foreground hover:text-foreground mb-2 text-center transition-colors"
                >
                  Clear conversation
                </button>
              )}
              <div className="flex gap-2 items-end">
                <textarea
                  value={assistQuestion}
                  onChange={(e) => setAssistQuestion(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAgentAssist(); } }}
                  placeholder="Ask about policies, FAQs, SOPs…"
                  rows={2}
                  className="flex-1 text-xs resize-none rounded-lg border border-input bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-400 placeholder:text-muted-foreground/50"
                  disabled={assistLoading}
                />
                <Button
                  size="icon"
                  onClick={() => handleAgentAssist()}
                  disabled={!assistQuestion.trim() || assistLoading}
                  className="h-9 w-9 shrink-0 bg-emerald-600 hover:bg-emerald-700"
                  data-testid="button-assist-send"
                >
                  {assistLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CornerDownLeft className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-center">Answers based on uploaded knowledge docs</p>
            </div>
          </div>
        )}
        </div>
      ) : tab === "closed" && selectedClosed ? (
        /* Closed Conversation Thread */
        <div className="flex-1 flex flex-col bg-background min-w-0">
          <div className="h-14 border-b flex items-center justify-between px-4 bg-background shrink-0">
            <div className="flex flex-col">
              <div className="font-bold text-[15px] flex items-center gap-1.5 leading-tight text-muted-foreground">
                {selectedClosed.customerName}
                {React.createElement(getChannelIcon(selectedClosed.channel), { className: `h-3.5 w-3.5 ${getChannelColor(selectedClosed.channel)}` })}
              </div>
              <div className="text-xs text-muted-foreground/60 leading-tight flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Closed {format(new Date(selectedClosed.closedAt), "MMM d, yyyy 'at' HH:mm")}
                {selectedClosed.closedByAgentName && ` · by ${selectedClosed.closedByAgentName}`}
              </div>
            </div>
            <Badge variant="outline" className="gap-1 text-muted-foreground/60 text-xs">
              <Archive className="h-3 w-3" /> Archived
            </Badge>
          </div>

          <div className="flex-1 overflow-y-auto bg-muted/10" ref={scrollRef}>
            {closedMessagesLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
            <div className="pt-4 pb-2">
              {closedMessages.map((msg, i) => {
                const isMe = msg.sender === 'agent';
                const isBot = msg.sender === 'bot';
                const showDateDivider = i === 0 || new Date(closedMessages[i - 1].originalCreatedAt).toDateString() !== new Date(msg.originalCreatedAt).toDateString();
                const prevSameSender = i > 0 && closedMessages[i - 1].sender === msg.sender;
                const senderName = isMe ? "Agent" : isBot ? "CommsBot" : selectedClosed.customerName;
                const avatarColor = isMe ? "bg-violet-500/60" : isBot ? "bg-blue-400/60" : "bg-emerald-500/60";

                return (
                  <React.Fragment key={msg.id}>
                    {showDateDivider && (
                      <div className="flex items-center gap-3 mx-4 my-4">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs text-muted-foreground font-medium px-2">
                          {format(new Date(msg.originalCreatedAt), "MMMM d, yyyy")}
                        </span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                    )}
                    <div className={`flex items-start gap-3 px-4 py-0.5 opacity-75 ${prevSameSender && !showDateDivider ? 'mt-0' : 'mt-3'}`}>
                      <div className="shrink-0 w-9 mt-0.5">
                        {!prevSameSender || showDateDivider ? (
                          isBot ? (
                            <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${avatarColor}`}>
                              <Bot className="h-5 w-5 text-white" />
                            </div>
                          ) : (
                            <div className={`h-9 w-9 rounded-lg flex items-center justify-center text-sm font-bold text-white ${avatarColor}`}>
                              {senderName.charAt(0)}
                            </div>
                          )
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        {(!prevSameSender || showDateDivider) && (
                          <div className="flex items-baseline gap-2 mb-0.5">
                            <span className="text-sm font-bold leading-none text-muted-foreground">{senderName}</span>
                            <span className="text-[11px] text-muted-foreground/60 leading-none">{format(new Date(msg.originalCreatedAt), "h:mm a")}</span>
                          </div>
                        )}
                        <p className="text-sm text-foreground/75 leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
            {!closedMessagesLoading && closedMessages.length === 0 && (
              <div className="flex justify-center items-center py-16 text-muted-foreground text-sm">
                <div className="text-center space-y-2">
                  <MessageSquare className="h-10 w-10 mx-auto opacity-20" />
                  <p>No messages in this conversation</p>
                </div>
              </div>
            )}
          </div>

          <div className="px-4 py-3 bg-background border-t shrink-0">
            <div className="flex items-center justify-center gap-2 py-2.5 text-sm text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
              <Archive className="h-4 w-4" /> This conversation is archived and read-only
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-muted/10">
          <div className="text-center text-muted-foreground">
            {tab === "closed"
              ? <Archive className="h-12 w-12 mx-auto mb-4 opacity-20" />
              : tab === "queue"
              ? <ListOrdered className="h-12 w-12 mx-auto mb-4 opacity-20" />
              : <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
            }
            <p className="text-sm">{tab === "closed" ? "Select a closed conversation to view" : tab === "queue" ? "Select a chat from the queue" : "Select a conversation to start chatting"}</p>
          </div>
        </div>
      )}

      {/* Close Confirmation Dialog */}
      <AlertDialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-muted-foreground" /> Close & Archive Conversation
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will move the conversation and all its messages to the Closed archive. This action cannot be undone. The conversation will no longer appear in the active inbox.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCloseConversation} className="bg-destructive hover:bg-destructive/90">
              Close & Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Follow-up Dialog */}
      <Dialog open={showFollowUpDialog} onOpenChange={setShowFollowUpDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-orange-500" /> Schedule Follow-up
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Follow-up Date & Time</Label>
              <input
                type="datetime-local"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Textarea
                placeholder="Add a reminder note..."
                value={followUpNote}
                onChange={(e) => setFollowUpNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFollowUpDialog(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!selectedId) return;
                followUpMutation.mutate({ id: selectedId, followUpAt: followUpDate, followUpNote: followUpNote || null });
              }}
              disabled={followUpMutation.isPending || !followUpDate}
              className="gap-2"
            >
              <CalendarClock className="h-4 w-4" />
              {followUpMutation.isPending ? "Saving..." : "Schedule Follow-up"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
