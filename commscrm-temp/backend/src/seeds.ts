import bcrypt from "bcryptjs";
import { Agent, Customer, Conversation, Message, Campaign, Feedback } from "./models/index.js";
import { logger } from "./lib/logger.js";

export async function ensureSuperAdmin(): Promise<void> {
  const existing = await Agent.findOne({ where: { role: "super_admin" } });
  if (existing) return;

  const passwordHash = await bcrypt.hash("superadmin123", 10);
  await Agent.create({
    name: "Super Admin",
    email: "superadmin@commscrm.com",
    passwordHash,
    role: "super_admin",
    isActive: true,
    allowedMenus: null,
  });
  logger.info("Super admin account created: superadmin@commscrm.com / superadmin123");
}

export async function seedDatabase(): Promise<void> {
  await ensureSuperAdmin();

  const agentCount = await Agent.count({ where: { role: ["admin", "agent", "supervisor"] } });
  if (agentCount > 0) {
    logger.info("CRM database already seeded, skipping");
    return;
  }

  logger.info("Seeding CRM database...");

  const passwordHash = await bcrypt.hash("password", 10);

  const agents = await Agent.bulkCreate([
    { name: "Sarah Mitchell", email: "sarah@commscrm.com", passwordHash, role: "admin", resolvedToday: 12, rating: 4.9, activeConversations: 3 },
    { name: "James Okafor", email: "james@commscrm.com", passwordHash, role: "agent", resolvedToday: 8, rating: 4.7, activeConversations: 5 },
    { name: "Priya Sharma", email: "priya@commscrm.com", passwordHash, role: "agent", resolvedToday: 15, rating: 4.8, activeConversations: 2 },
    { name: "Carlos Rivera", email: "carlos@commscrm.com", passwordHash, role: "supervisor", resolvedToday: 10, rating: 4.6, activeConversations: 4 },
    { name: "Aisha Mensah", email: "aisha@commscrm.com", passwordHash, role: "agent", resolvedToday: 6, rating: 4.5, activeConversations: 6 },
  ]);

  const customers = await Customer.bulkCreate([
    { name: "Daniel Adeyemi", phone: "+234 801 234 5678", email: "daniel@example.com", channel: "whatsapp", tags: ["VIP", "premium"], lastSeen: new Date(), totalConversations: 5 },
    { name: "Fatima Al-Hassan", phone: "+234 802 345 6789", email: "fatima@example.com", channel: "facebook", tags: ["returning"], lastSeen: new Date(Date.now() - 3600000), totalConversations: 3 },
    { name: "Emeka Obi", phone: "+234 803 456 7890", channel: "whatsapp", tags: ["new"], lastSeen: new Date(Date.now() - 7200000), totalConversations: 1 },
    { name: "Ngozi Eze", phone: "+234 804 567 8901", email: "ngozi@example.com", channel: "instagram", tags: ["influencer", "VIP"], lastSeen: new Date(Date.now() - 86400000), totalConversations: 8 },
    { name: "Chidi Nwosu", phone: "+234 805 678 9012", channel: "whatsapp", tags: [], lastSeen: new Date(Date.now() - 172800000), totalConversations: 2 },
    { name: "Blessing Okonkwo", phone: "+234 806 789 0123", email: "blessing@example.com", channel: "facebook", tags: ["premium"], lastSeen: new Date(), totalConversations: 4 },
    { name: "Seun Adesanya", phone: "+234 807 890 1234", channel: "instagram", tags: ["new"], lastSeen: new Date(Date.now() - 1800000), totalConversations: 1 },
    { name: "Tola Bamidele", phone: "+234 808 901 2345", email: "tola@example.com", channel: "whatsapp", tags: ["returning"], lastSeen: new Date(Date.now() - 10800000), totalConversations: 6 },
  ]);

  const now = new Date();
  const h = (hours: number) => new Date(now.getTime() - hours * 3600000);

  const conversations = await Conversation.bulkCreate([
    { customerId: customers[0].id, assignedAgentId: agents[0].id, channel: "whatsapp", status: "open", unreadCount: 3, lastMessageAt: h(0.1) },
    { customerId: customers[1].id, assignedAgentId: agents[1].id, channel: "facebook", status: "pending", unreadCount: 0, lastMessageAt: h(0.5) },
    { customerId: customers[2].id, assignedAgentId: null, channel: "whatsapp", status: "open", unreadCount: 2, lastMessageAt: h(1) },
    { customerId: customers[3].id, assignedAgentId: agents[2].id, channel: "instagram", status: "resolved", unreadCount: 0, lastMessageAt: h(2) },
    { customerId: customers[4].id, assignedAgentId: agents[1].id, channel: "whatsapp", status: "open", unreadCount: 1, lastMessageAt: h(3) },
    { customerId: customers[5].id, assignedAgentId: agents[3].id, channel: "facebook", status: "pending", unreadCount: 0, lastMessageAt: h(4) },
    { customerId: customers[6].id, assignedAgentId: null, channel: "instagram", status: "open", unreadCount: 4, lastMessageAt: h(0.25) },
    { customerId: customers[7].id, assignedAgentId: agents[4].id, channel: "whatsapp", status: "resolved", unreadCount: 0, lastMessageAt: h(24) },
  ]);

  await Message.bulkCreate([
    { conversationId: conversations[0].id, sender: "customer", content: "Hi, I need help with my order #12345. It has been 5 days and I haven't received it.", isRead: true },
    { conversationId: conversations[0].id, sender: "agent", content: "Hello Daniel! I'm so sorry to hear that. Let me look into your order right away.", isRead: true },
    { conversationId: conversations[0].id, sender: "customer", content: "It was supposed to arrive last Tuesday. I'm getting worried.", isRead: false },

    { conversationId: conversations[1].id, sender: "customer", content: "Can I get a refund for my subscription? I haven't used the service this month.", isRead: true },
    { conversationId: conversations[1].id, sender: "agent", content: "Hi Fatima! I understand. I'll check your account and process the refund within 3-5 business days.", isRead: true },

    { conversationId: conversations[2].id, sender: "customer", content: "Hello, is there a discount available for bulk orders?", isRead: false },
    { conversationId: conversations[2].id, sender: "customer", content: "I'm interested in ordering 50+ units.", isRead: false },

    { conversationId: conversations[3].id, sender: "customer", content: "My account got hacked, I can't login anymore!", isRead: true },
    { conversationId: conversations[3].id, sender: "agent", content: "I've reset your password and secured your account. Check your email.", isRead: true },
    { conversationId: conversations[3].id, sender: "customer", content: "Thank you so much! That was fast.", isRead: true },
    { conversationId: conversations[3].id, sender: "agent", content: "You're welcome! Your account is now secure. Stay safe.", isRead: true },

    { conversationId: conversations[4].id, sender: "customer", content: "When will my membership renew?", isRead: true },
    { conversationId: conversations[4].id, sender: "customer", content: "I want to upgrade to the premium plan.", isRead: false },

    { conversationId: conversations[6].id, sender: "customer", content: "How do I track my delivery?", isRead: false },
    { conversationId: conversations[6].id, sender: "customer", content: "I placed an order 2 hours ago", isRead: false },
    { conversationId: conversations[6].id, sender: "bot", content: "Your order #67890 is being processed. Estimated delivery: 2-3 hours.", isRead: false },
    { conversationId: conversations[6].id, sender: "customer", content: "Thanks, but can I talk to a human?", isRead: false },
  ]);

  await Campaign.bulkCreate([
    {
      name: "Black Friday Flash Sale",
      channel: "whatsapp",
      status: "sent",
      message: "Exclusive Black Friday deals just for you! Get up to 50% off on all products. Shop now before stocks run out!",
      recipients: 2840,
      sentAt: new Date(Date.now() - 7 * 86400000),
      openRate: 72.4,
      clickRate: 31.8,
    },
    {
      name: "New Year Promo",
      channel: "facebook",
      status: "sent",
      message: "Start the new year right! Get our premium plan for half price this January. Offer ends soon.",
      recipients: 1560,
      sentAt: new Date(Date.now() - 14 * 86400000),
      openRate: 65.2,
      clickRate: 24.5,
    },
    {
      name: "Re-engagement Campaign",
      channel: "instagram",
      status: "scheduled",
      message: "We miss you! Come back and discover what's new. Here's a 20% welcome-back discount just for you.",
      recipients: 890,
      scheduledAt: new Date(Date.now() + 2 * 86400000),
      openRate: 0,
      clickRate: 0,
    },
    {
      name: "Product Launch Announcement",
      channel: "whatsapp",
      status: "draft",
      message: "Exciting news! Our brand-new product is dropping this week. Be the first to get it.",
      recipients: 0,
      openRate: 0,
      clickRate: 0,
    },
  ]);

  await Feedback.bulkCreate([
    { conversationId: conversations[0].id, customerId: customers[0].id, rating: 5, comment: "Very helpful and quick response!", channel: "whatsapp", agentId: agents[0].id },
    { conversationId: conversations[1].id, customerId: customers[1].id, rating: 4, comment: "Good service, resolved my issue.", channel: "facebook", agentId: agents[1].id },
    { conversationId: conversations[2].id, customerId: customers[2].id, rating: 3, comment: "Took a while but eventually sorted.", channel: "instagram", agentId: agents[2].id },
    { conversationId: conversations[3].id, customerId: customers[3].id, rating: 5, comment: "Excellent! Went above and beyond.", channel: "whatsapp", agentId: agents[0].id },
    { conversationId: conversations[4].id, customerId: customers[4].id, rating: 2, comment: "Response was slow and confusing.", channel: "facebook", agentId: agents[3].id },
    { conversationId: conversations[5].id, customerId: customers[5].id, rating: 4, comment: "Overall satisfied with the support.", channel: "whatsapp", agentId: agents[1].id },
    { conversationId: conversations[6].id, customerId: customers[6].id, rating: 5, comment: "Amazing experience, 10/10!", channel: "instagram", agentId: agents[2].id },
    { customerId: customers[0].id, rating: 4, comment: "Follow-up was appreciated.", channel: "whatsapp", agentId: agents[0].id },
    { customerId: customers[2].id, rating: 3, channel: "facebook", agentId: agents[1].id },
    { customerId: customers[4].id, rating: 5, comment: "Superb help!", channel: "whatsapp", agentId: agents[0].id },
  ]);

  logger.info("CRM database seeded successfully");
}
