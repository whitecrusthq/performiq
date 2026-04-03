import { SiWhatsapp, SiFacebook, SiInstagram, SiTiktok } from "react-icons/si";
import { Mail, MessageSquare, Bell } from "lucide-react";

export type Agent = {
  id: string;
  name: string;
  avatar: string;
  email: string;
  role: 'admin' | 'agent';
  activeConversations: number;
  resolvedToday: number;
  rating: number;
};

export type Message = {
  id: string;
  sender: 'customer' | 'agent' | 'bot';
  content: string;
  timestamp: string;
};

export type Customer = {
  id: string;
  name: string;
  avatar: string;
  phone: string;
  email: string;
  channel: 'whatsapp' | 'facebook' | 'instagram';
  tags: string[];
  totalConversations: number;
  lastSeen: string;
  notes: string;
};

export type Conversation = {
  id: string;
  customer: Pick<Customer, 'name' | 'avatar' | 'phone'>;
  channel: 'whatsapp' | 'facebook' | 'instagram';
  status: 'open' | 'pending' | 'resolved' | 'closed';
  messages: Message[];
  assignedAgent: Agent | null;
  unreadCount: number;
  lastMessageAt: string;
};

export type Campaign = {
  id: string;
  name: string;
  channel: 'whatsapp' | 'facebook' | 'instagram' | 'sms' | 'email' | 'push' | 'tiktok';
  status: 'draft' | 'scheduled' | 'sent';
  recipients: number;
  sentAt: string | null;
  message: string;
  openRate: number;
  clickRate: number;
};

const CHANNEL_META: Record<string, { label: string; color: string; textColor: string; bg: string; border: string }> = {
  whatsapp:  { label: "WhatsApp",          color: "#25D366", textColor: "text-[#25D366]",  bg: "bg-green-50 dark:bg-green-950/30",     border: "border-green-100 dark:border-green-900" },
  facebook:  { label: "Facebook",          color: "#1877F2", textColor: "text-[#1877F2]",  bg: "bg-blue-50 dark:bg-blue-950/30",       border: "border-blue-100 dark:border-blue-900" },
  instagram: { label: "Instagram",         color: "#E4405F", textColor: "text-[#E4405F]",  bg: "bg-pink-50 dark:bg-pink-950/30",       border: "border-pink-100 dark:border-pink-900" },
  sms:       { label: "SMS",               color: "#7c3aed", textColor: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-950/30",   border: "border-violet-100 dark:border-violet-900" },
  email:     { label: "Email",             color: "#0ea5e9", textColor: "text-sky-600 dark:text-sky-400",       bg: "bg-sky-50 dark:bg-sky-950/30",         border: "border-sky-100 dark:border-sky-900" },
  push:      { label: "Push Notification", color: "#f59e0b", textColor: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-950/30",     border: "border-amber-100 dark:border-amber-900" },
  tiktok:    { label: "TikTok",            color: "#010101", textColor: "text-foreground",                      bg: "bg-muted/30",                          border: "border-muted" },
};

export function getChannelMeta(channel: string) {
  return CHANNEL_META[channel] ?? { label: channel, color: "#888", textColor: "text-muted-foreground", bg: "bg-muted/20", border: "border-muted" };
}

export function getChannelIcon(channel: string) {
  switch (channel) {
    case 'whatsapp':  return SiWhatsapp;
    case 'facebook':  return SiFacebook;
    case 'instagram': return SiInstagram;
    case 'tiktok':    return SiTiktok;
    case 'sms':       return MessageSquare;
    case 'email':     return Mail;
    case 'push':      return Bell;
    default:          return MessageSquare;
  }
}

export function getChannelColor(channel: string) {
  return CHANNEL_META[channel]?.textColor ?? "text-muted-foreground";
}

export function getStatusColor(status: 'open' | 'pending' | 'resolved' | 'closed') {
  switch (status) {
    case 'open': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'resolved': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'closed': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
    default: return 'bg-gray-100 text-gray-800';
  }
}
