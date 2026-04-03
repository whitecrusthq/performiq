import { SiWhatsapp, SiFacebook, SiInstagram } from "react-icons/si";

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
  channel: 'whatsapp' | 'facebook' | 'instagram';
  status: 'draft' | 'scheduled' | 'sent';
  recipients: number;
  sentAt: string | null;
  message: string;
  openRate: number;
  clickRate: number;
};

export const agents: Agent[] = [
  { id: '1', name: 'Agent Smith', avatar: 'https://i.pravatar.cc/150?u=1', email: 'smith@hira.com', role: 'admin', activeConversations: 5, resolvedToday: 24, rating: 4.8 },
  { id: '2', name: 'Sarah Connor', avatar: 'https://i.pravatar.cc/150?u=2', email: 'sarah@hira.com', role: 'agent', activeConversations: 8, resolvedToday: 19, rating: 4.9 },
  { id: '3', name: 'John Doe', avatar: 'https://i.pravatar.cc/150?u=3', email: 'john@hira.com', role: 'agent', activeConversations: 3, resolvedToday: 15, rating: 4.5 },
];

export const customers: Customer[] = [
  { id: 'c1', name: 'Alice Cooper', avatar: 'https://i.pravatar.cc/150?u=c1', phone: '+1234567890', email: 'alice@example.com', channel: 'whatsapp', tags: ['VIP', 'Returning'], totalConversations: 5, lastSeen: new Date(Date.now() - 1000 * 60 * 5).toISOString(), notes: 'Prefers quick responses. Interested in bulk orders.' },
  { id: 'c2', name: 'Bob Martin', avatar: 'https://i.pravatar.cc/150?u=c2', phone: '+0987654321', email: 'bob@example.com', channel: 'facebook', tags: ['New'], totalConversations: 1, lastSeen: new Date(Date.now() - 1000 * 60 * 60).toISOString(), notes: 'Asked about return policy.' },
  { id: 'c3', name: 'Charlie Brown', avatar: 'https://i.pravatar.cc/150?u=c3', phone: '+1122334455', email: 'charlie@example.com', channel: 'instagram', tags: ['Complainer'], totalConversations: 12, lastSeen: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), notes: 'Needs extra attention.' },
  { id: 'c4', name: 'Diana Prince', avatar: 'https://i.pravatar.cc/150?u=c4', phone: '+1555666777', email: 'diana@example.com', channel: 'whatsapp', tags: ['Wholesale'], totalConversations: 8, lastSeen: new Date(Date.now() - 1000 * 60 * 2).toISOString(), notes: 'Monthly buyer.' },
  { id: 'c5', name: 'Evan Wright', avatar: 'https://i.pravatar.cc/150?u=c5', phone: '+1999888777', email: 'evan@example.com', channel: 'facebook', tags: [], totalConversations: 2, lastSeen: new Date(Date.now() - 1000 * 60 * 15).toISOString(), notes: '' },
];

export const conversations: Conversation[] = [
  {
    id: 'conv1',
    customer: { name: 'Alice Cooper', avatar: 'https://i.pravatar.cc/150?u=c1', phone: '+1234567890' },
    channel: 'whatsapp',
    status: 'open',
    assignedAgent: agents[0],
    unreadCount: 2,
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    messages: [
      { id: 'm1', sender: 'customer', content: 'Hi, I need help with my recent order #4592', timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString() },
      { id: 'm2', sender: 'bot', content: 'Hello Alice! I see you are asking about order #4592. I am connecting you to an agent.', timestamp: new Date(Date.now() - 1000 * 60 * 9).toISOString() },
      { id: 'm3', sender: 'customer', content: 'It arrived damaged and I need a replacement sent ASAP.', timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
      { id: 'm4', sender: 'customer', content: 'Are you there?', timestamp: new Date(Date.now() - 1000 * 60 * 1).toISOString() },
    ]
  },
  {
    id: 'conv2',
    customer: { name: 'Bob Martin', avatar: 'https://i.pravatar.cc/150?u=c2', phone: '+0987654321' },
    channel: 'facebook',
    status: 'pending',
    assignedAgent: agents[1],
    unreadCount: 0,
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    messages: [
      { id: 'm5', sender: 'customer', content: 'What is your return policy?', timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString() },
      { id: 'm6', sender: 'agent', content: 'Hi Bob, we have a 30-day no questions asked return policy. Do you have a specific item you want to return?', timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString() },
    ]
  },
  {
    id: 'conv3',
    customer: { name: 'Charlie Brown', avatar: 'https://i.pravatar.cc/150?u=c3', phone: '+1122334455' },
    channel: 'instagram',
    status: 'resolved',
    assignedAgent: agents[2],
    unreadCount: 0,
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    messages: [
      { id: 'm7', sender: 'customer', content: 'Where is my tracking number?', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString() },
      { id: 'm8', sender: 'agent', content: 'Hi Charlie, your tracking number is TRK987654321. It should update in 24 hours.', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24.5).toISOString() },
      { id: 'm9', sender: 'customer', content: 'Thanks!', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
    ]
  },
  {
    id: 'conv4',
    customer: { name: 'Diana Prince', avatar: 'https://i.pravatar.cc/150?u=c4', phone: '+1555666777' },
    channel: 'whatsapp',
    status: 'open',
    assignedAgent: null,
    unreadCount: 1,
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    messages: [
      { id: 'm10', sender: 'customer', content: 'Can I get a quote for 50 units of SKU-123?', timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString() },
    ]
  }
];

export const campaigns: Campaign[] = [
  { id: 'camp1', name: 'Summer Sale 2024', channel: 'whatsapp', status: 'sent', recipients: 15420, sentAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), message: 'Our summer sale is here! Get 20% off all orders this weekend.', openRate: 68.5, clickRate: 14.2 },
  { id: 'camp2', name: 'New Product Launch', channel: 'facebook', status: 'scheduled', recipients: 8500, sentAt: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(), message: 'Introducing the new Pro Line. Available starting tomorrow.', openRate: 0, clickRate: 0 },
  { id: 'camp3', name: 'VIP Exclusive Preview', channel: 'instagram', status: 'draft', recipients: 1200, sentAt: null, message: 'Hey VIP! Check out our new collection before anyone else.', openRate: 0, clickRate: 0 },
];

export const getChannelIcon = (channel: string) => {
  switch (channel) {
    case 'whatsapp': return SiWhatsapp;
    case 'facebook': return SiFacebook;
    case 'instagram': return SiInstagram;
    default: return SiWhatsapp;
  }
};

export const getChannelColor = (channel: string) => {
  switch (channel) {
    case 'whatsapp': return 'text-[#25D366]';
    case 'facebook': return 'text-[#1877F2]';
    case 'instagram': return 'text-[#E4405F]';
    default: return 'text-gray-500';
  }
};

export const getStatusColor = (status: string) => {
  switch (status) {
    case 'open': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'pending': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    case 'resolved': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'closed': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    default: return 'bg-gray-100 text-gray-800';
  }
};
