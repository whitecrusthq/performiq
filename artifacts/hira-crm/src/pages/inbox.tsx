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
import {
  Search, MoreVertical, Send, CheckCircle, Paperclip, Smile,
  UserPlus, MessageSquare, Loader2, Sparkles, Bot, Zap, RefreshCw,
  ChevronUp, Lock, AlertTriangle, XCircle, Archive, Clock
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
  status: "open" | "pending" | "resolved";
  unreadCount: number;
  lastMessageAt: string | null;
  customer: ApiCustomer;
  assignedAgent: ApiAgent | null;
  isLocked: boolean;
  lockedByAgent: { id: number; name: string } | null;
  lockedByAgentId: number | null;
  lastMessage: { content: string; sender: "customer" | "agent" | "bot" } | null;
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

type InboxTab = "active" | "closed";

export default function Inbox() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { agent } = useAuth();
  const [tab, setTab] = useState<InboxTab>("active");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedClosedId, setSelectedClosedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [replyText, setReplyText] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isAutoResponding, setIsAutoResponding] = useState(false);
  const [lockConflict, setLockConflict] = useState<{ name: string } | null>(null);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const convParams = new URLSearchParams();
  if (filter !== "all") convParams.set("status", filter);
  if (searchQuery) convParams.set("search", searchQuery);
  convParams.set("limit", "50");

  const { data: convData, isLoading: convLoading } = useQuery<ConversationListResponse>({
    queryKey: ["conversations", filter, searchQuery],
    queryFn: () => apiGet(`/conversations?${convParams.toString()}`),
    refetchInterval: 5000,
    enabled: tab === "active",
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
    if (conversations.length > 0 && !selectedId && tab === "active") {
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
    <div className="flex h-full bg-background overflow-hidden">
      {/* Left Panel */}
      <div className="w-[380px] border-r flex flex-col bg-card shrink-0">
        <div className="p-4 border-b flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Inbox</h2>
            <Tabs value={tab} onValueChange={(v) => { setTab(v as InboxTab); setSelectedId(null); setSelectedClosedId(null); }}>
              <TabsList className="h-7">
                <TabsTrigger value="active" className="text-xs h-6 px-2">Active</TabsTrigger>
                <TabsTrigger value="closed" className="text-xs h-6 px-2 gap-1">
                  <Archive className="h-3 w-3" /> Closed
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="pl-9 bg-muted/50 border-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-inbox"
              />
            </div>
            {tab === "active" && (
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[100px] bg-muted/50 border-none" data-testid="select-filter-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="divide-y">
            {/* Active Conversations */}
            {tab === "active" && (
              <>
                {convLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
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
                      className={`px-4 py-3 cursor-pointer transition-colors relative flex items-start gap-3 ${
                        isSelected
                          ? 'bg-primary/8 border-l-[3px] border-l-primary'
                          : 'border-l-[3px] border-l-transparent hover:bg-muted/40'
                      }`}
                      data-testid={`conversation-item-${conv.id}`}
                    >
                      {/* Avatar with channel badge */}
                      <div className="relative shrink-0 mt-0.5">
                        <div className={`h-11 w-11 rounded-full flex items-center justify-center text-base font-bold text-white ${
                          isSelected ? 'bg-primary/80' : 'bg-muted-foreground/30'
                        }`}>
                          {conv.customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-card flex items-center justify-center border border-border">
                          <Icon className={`h-3 w-3 ${getChannelColor(conv.channel)}`} />
                        </div>
                        {/* Live pulse dot */}
                        {isLive && !lockedByOther && (
                          <span className="absolute -top-0.5 -left-0.5 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                          </span>
                        )}
                        {lockedByOther && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="absolute -top-0.5 -left-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400">
                                <Lock className="h-2 w-2 text-white" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{conv.lockedByAgent?.name} is handling this</TooltipContent>
                          </Tooltip>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Name + time row */}
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className={`text-sm font-semibold truncate ${hasUnread ? 'text-foreground' : 'text-foreground/80'}`}>
                            {conv.customer.name}
                          </span>
                          <span className={`text-[11px] shrink-0 ${hasUnread ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                            {conv.lastMessageAt ? format(new Date(conv.lastMessageAt), "HH:mm") : ""}
                          </span>
                        </div>

                        {/* Preview + unread row */}
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs truncate flex-1 ${hasUnread ? 'text-foreground/70 font-medium' : 'text-muted-foreground'}`}>
                            {lockedByOther
                              ? <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1"><Lock className="h-2.5 w-2.5 inline" /> {conv.lockedByAgent?.name}</span>
                              : lastMsgPreview
                            }
                          </span>
                          {hasUnread && (
                            <span className={`shrink-0 h-5 min-w-[20px] rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center px-1.5 ${isLive ? 'animate-pulse' : ''}`}>
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>

                        {/* Status row */}
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-4 border-none ${getStatusColor(conv.status)}`}>
                            {conv.status}
                          </Badge>
                          {conv.assignedAgent && (
                            <span className="text-[10px] text-muted-foreground truncate">
                              · {conv.assignedAgent.name.split(' ')[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!convLoading && conversations.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground text-sm">No active conversations.</div>
                )}
              </>
            )}

            {/* Closed Conversations */}
            {tab === "closed" && (
              <>
                {closedLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
                {closedConversations.map((conv) => {
                  const Icon = getChannelIcon(conv.channel);
                  const isSelected = conv.id === selectedClosedId;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => setSelectedClosedId(conv.id)}
                      className={`px-4 py-3 cursor-pointer transition-colors flex items-start gap-3 ${
                        isSelected
                          ? 'bg-muted/40 border-l-[3px] border-l-muted-foreground'
                          : 'border-l-[3px] border-l-transparent hover:bg-muted/30'
                      }`}
                    >
                      <div className="relative shrink-0 mt-0.5">
                        <div className="h-11 w-11 rounded-full flex items-center justify-center text-base font-bold text-white bg-muted-foreground/20">
                          {conv.customerName.charAt(0).toUpperCase()}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-card flex items-center justify-center border border-border">
                          <Icon className={`h-3 w-3 ${getChannelColor(conv.channel)}`} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="text-sm font-medium truncate text-muted-foreground">{conv.customerName}</span>
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            {formatDistanceToNow(new Date(conv.closedAt), { addSuffix: true })}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate mb-1">
                          {conv.customerPhone ?? conv.channel}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground bg-muted/30">
                            <Archive className="h-2.5 w-2.5 mr-1" /> Closed
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{conv.messageCount} msgs</span>
                          {conv.closedByAgentName && (
                            <span className="text-[10px] text-muted-foreground truncate">· {conv.closedByAgentName.split(' ')[0]}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!closedLoading && closedConversations.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground text-sm">No closed conversations yet.</div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel */}
      {tab === "active" && selectedConv ? (
        <div className="flex-1 flex flex-col bg-background min-w-0">
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

          {/* Chat Header */}
          <div className="h-[72px] border-b flex items-center justify-between px-6 bg-card shrink-0">
            <div className="flex items-center gap-4">
              <Avatar className="h-10 w-10 border">
                <AvatarFallback>{selectedConv.customer.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-semibold flex items-center gap-2">
                  {selectedConv.customer.name}
                  {React.createElement(getChannelIcon(selectedConv.channel), { className: `h-4 w-4 ${getChannelColor(selectedConv.channel)}` })}
                </div>
                <div className="text-sm text-muted-foreground">{selectedConv.customer.phone}</div>
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

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto px-6 py-4"
            ref={scrollRef}
            style={{
              backgroundImage: `radial-gradient(circle, hsl(var(--muted-foreground)/0.07) 1px, transparent 1px)`,
              backgroundSize: '20px 20px',
              backgroundColor: 'hsl(var(--muted)/0.3)',
            }}
          >
            {messagesLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
            <div className="space-y-1">
              {messages.map((msg, i) => {
                const isMe = msg.sender === 'agent';
                const isBot = msg.sender === 'bot';
                const isCustomer = msg.sender === 'customer';
                const showDateDivider = i === 0 || new Date(messages[i - 1].createdAt).toDateString() !== new Date(msg.createdAt).toDateString();
                const prevSameSender = i > 0 && messages[i - 1].sender === msg.sender;
                const nextSameSender = i < messages.length - 1 && messages[i + 1].sender === msg.sender;
                return (
                  <React.Fragment key={msg.id}>
                    {showDateDivider && (
                      <div className="flex justify-center my-4">
                        <div className="bg-card/80 backdrop-blur-sm shadow-sm px-4 py-1 rounded-full text-xs text-muted-foreground font-medium border">
                          {format(new Date(msg.createdAt), "MMMM d, yyyy")}
                        </div>
                      </div>
                    )}
                    <div className={`flex items-end gap-2 ${isMe || isBot ? 'flex-row-reverse' : 'flex-row'} ${prevSameSender ? 'mt-0.5' : 'mt-3'}`}>
                      {/* Avatar: only show for customer, only on last in a group */}
                      {isCustomer && (
                        <div className={`h-7 w-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white bg-muted-foreground/40 ${nextSameSender ? 'opacity-0' : ''}`}>
                          {selectedConv.customer.name.charAt(0)}
                        </div>
                      )}
                      {isBot && (
                        <div className={`h-7 w-7 rounded-full shrink-0 flex items-center justify-center bg-blue-500 ${nextSameSender ? 'opacity-0' : ''}`}>
                          <Bot className="h-4 w-4 text-white" />
                        </div>
                      )}

                      {/* Bubble */}
                      <div className={`max-w-[68%] flex flex-col ${isMe || isBot ? 'items-end' : 'items-start'}`}>
                        <div className={`
                          px-3.5 py-2 shadow-sm relative
                          ${isMe
                            ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-md'
                            : isBot
                            ? 'bg-blue-500 text-white rounded-2xl rounded-bl-md'
                            : 'bg-card text-foreground rounded-2xl rounded-bl-md border border-border/50'
                          }
                        `}>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                        </div>
                        <div className={`flex items-center gap-1 mt-1 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                          <span className="text-[11px] text-muted-foreground">{format(new Date(msg.createdAt), "HH:mm")}</span>
                          {isMe && <CheckCircle className="h-3 w-3 text-primary/70" />}
                          {isBot && <span className="text-[10px] text-blue-500 font-medium">CommsBot</span>}
                        </div>
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
                  <p>No messages yet</p>
                </div>
              </div>
            )}
          </div>

          {/* AI Suggestions Panel */}
          {showSuggestions && (
            <div className="border-t bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-medium text-violet-700 dark:text-violet-400">
                  <Sparkles className="h-4 w-4" /> AI Reply Suggestions
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={handleGetSuggestions} disabled={isLoadingSuggestions} className="h-6 px-2 text-xs">
                    <RefreshCw className={`h-3 w-3 mr-1 ${isLoadingSuggestions ? 'animate-spin' : ''}`} /> Refresh
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowSuggestions(false)} className="h-6 px-2 text-xs">
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {isLoadingSuggestions ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating suggestions...
                </div>
              ) : (
                <div className="space-y-1.5">
                  {aiSuggestions.map((s, i) => (
                    <button key={i} onClick={() => { setReplyText(s); setShowSuggestions(false); }}
                      className="w-full text-left text-sm px-3 py-2 rounded-lg bg-white/70 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 border border-violet-200/60 dark:border-violet-800/60 transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Reply Box */}
          <div className="p-4 bg-card border-t shrink-0">
            {isLockedByOther ? (
              <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground bg-muted/30 rounded-xl border">
                <Lock className="h-4 w-4" />
                <span>Read-only — <strong>{selectedConv.lockedByAgent?.name}</strong> is handling this</span>
              </div>
            ) : (
              <>
                <div className="flex items-end gap-2 bg-muted/30 rounded-xl border p-2 focus-within:ring-1 focus-within:ring-ring transition-all">
                  <div className="flex gap-1 pb-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground">
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground">
                      <Smile className="h-4 w-4" />
                    </Button>
                  </div>
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Type a message... (Enter to send)"
                    className="flex-1 bg-transparent border-none resize-none outline-none max-h-32 min-h-[40px] py-2 px-2 text-sm"
                    rows={1}
                    data-testid="textarea-reply"
                  />
                  <div className="flex gap-2 pb-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={handleGetSuggestions} disabled={isLoadingSuggestions}
                          className="h-9 w-9 rounded-lg text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950" data-testid="button-ai-suggest">
                          {isLoadingSuggestions ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>AI reply suggestions</TooltipContent>
                    </Tooltip>
                    <Button onClick={handleSend} disabled={!replyText.trim() || sendMessageMutation.isPending}
                      className="h-9 px-4 rounded-lg" data-testid="button-send-reply">
                      {sendMessageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-2" />Send</>}
                    </Button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5 px-2">
                  ⚡ AI suggestions · Bot Reply to auto-respond · Options menu to close & archive
                </p>
              </>
            )}
          </div>
        </div>
      ) : tab === "closed" && selectedClosed ? (
        /* Closed Conversation Thread */
        <div className="flex-1 flex flex-col bg-background min-w-0">
          <div className="h-[72px] border-b flex items-center justify-between px-6 bg-card shrink-0">
            <div className="flex items-center gap-4">
              <Avatar className="h-10 w-10 border bg-muted">
                <AvatarFallback className="text-muted-foreground">{selectedClosed.customerName.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-semibold flex items-center gap-2 text-muted-foreground">
                  {selectedClosed.customerName}
                  {React.createElement(getChannelIcon(selectedClosed.channel), { className: `h-4 w-4 ${getChannelColor(selectedClosed.channel)}` })}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  Closed {format(new Date(selectedClosed.closedAt), "MMM d, yyyy 'at' HH:mm")}
                  {selectedClosed.closedByAgentName && ` · by ${selectedClosed.closedByAgentName}`}
                </div>
              </div>
            </div>
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <Archive className="h-3 w-3" /> Archived · Read-only
            </Badge>
          </div>

          <div
            className="flex-1 overflow-y-auto px-6 py-4"
            ref={scrollRef}
            style={{
              backgroundImage: `radial-gradient(circle, hsl(var(--muted-foreground)/0.07) 1px, transparent 1px)`,
              backgroundSize: '20px 20px',
              backgroundColor: 'hsl(var(--muted)/0.3)',
            }}
          >
            {closedMessagesLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
            <div className="space-y-1">
              {closedMessages.map((msg, i) => {
                const isMe = msg.sender === 'agent';
                const isBot = msg.sender === 'bot';
                const isCustomer = msg.sender === 'customer';
                const showDateDivider = i === 0 || new Date(closedMessages[i - 1].originalCreatedAt).toDateString() !== new Date(msg.originalCreatedAt).toDateString();
                const prevSameSender = i > 0 && closedMessages[i - 1].sender === msg.sender;
                const nextSameSender = i < closedMessages.length - 1 && closedMessages[i + 1].sender === msg.sender;
                return (
                  <React.Fragment key={msg.id}>
                    {showDateDivider && (
                      <div className="flex justify-center my-4">
                        <div className="bg-card/80 backdrop-blur-sm shadow-sm px-4 py-1 rounded-full text-xs text-muted-foreground font-medium border">
                          {format(new Date(msg.originalCreatedAt), "MMMM d, yyyy")}
                        </div>
                      </div>
                    )}
                    <div className={`flex items-end gap-2 opacity-80 ${isMe || isBot ? 'flex-row-reverse' : 'flex-row'} ${prevSameSender ? 'mt-0.5' : 'mt-3'}`}>
                      {isCustomer && (
                        <div className={`h-7 w-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white bg-muted-foreground/30 ${nextSameSender ? 'opacity-0' : ''}`}>
                          {selectedClosed.customerName.charAt(0)}
                        </div>
                      )}
                      {isBot && (
                        <div className={`h-7 w-7 rounded-full shrink-0 flex items-center justify-center bg-blue-400 ${nextSameSender ? 'opacity-0' : ''}`}>
                          <Bot className="h-4 w-4 text-white" />
                        </div>
                      )}
                      <div className={`max-w-[68%] flex flex-col ${isMe || isBot ? 'items-end' : 'items-start'}`}>
                        <div className={`
                          px-3.5 py-2 shadow-sm
                          ${isMe
                            ? 'bg-primary/60 text-primary-foreground rounded-2xl rounded-br-md'
                            : isBot
                            ? 'bg-blue-400 text-white rounded-2xl rounded-bl-md'
                            : 'bg-card/80 text-foreground rounded-2xl rounded-bl-md border border-border/40'
                          }
                        `}>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                        </div>
                        <div className={`flex items-center gap-1 mt-1 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                          <span className="text-[11px] text-muted-foreground">{format(new Date(msg.originalCreatedAt), "HH:mm")}</span>
                          {isBot && <span className="text-[10px] text-blue-400 font-medium">CommsBot</span>}
                        </div>
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

          <div className="p-4 bg-card border-t shrink-0">
            <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground bg-muted/30 rounded-xl border">
              <Archive className="h-4 w-4" /> This conversation is archived and read-only
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-muted/10">
          <div className="text-center text-muted-foreground">
            {tab === "closed" ? <Archive className="h-12 w-12 mx-auto mb-4 opacity-20" /> : <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />}
            <p>{tab === "closed" ? "Select a closed conversation to view" : "Select a conversation to start chatting"}</p>
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
    </div>
  );
}
