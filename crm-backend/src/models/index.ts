export { Agent } from "./Agent.js";
export { Customer } from "./Customer.js";
export { Conversation } from "./Conversation.js";
export { Message } from "./Message.js";
export { Campaign } from "./Campaign.js";
export { Channel } from "./Channel.js";
export { ClosedConversation } from "./ClosedConversation.js";
export { ClosedMessage } from "./ClosedMessage.js";
export { Feedback } from "./Feedback.js";
export { KnowledgeDoc } from "./KnowledgeDoc.js";
export { AiSettings } from "./AiSettings.js";
export type { AiProvider } from "./AiSettings.js";
export { EmailSettings } from "./EmailSettings.js";
export { AgentKpi } from "./AgentKpi.js";
export { AgentAttendance } from "./AgentAttendance.js";
export { AgentAttendancePing } from "./AgentAttendancePing.js";

import { Agent } from "./Agent.js";
import { Customer } from "./Customer.js";
import { Conversation } from "./Conversation.js";
import { Message } from "./Message.js";
import { Channel } from "./Channel.js";
import { ClosedConversation } from "./ClosedConversation.js";
import { ClosedMessage } from "./ClosedMessage.js";
import { Feedback } from "./Feedback.js";

Customer.hasMany(Conversation, { foreignKey: "customerId", as: "conversations" });
Conversation.belongsTo(Customer, { foreignKey: "customerId", as: "customer" });

Agent.hasMany(Conversation, { foreignKey: "assignedAgentId", as: "conversations" });
Conversation.belongsTo(Agent, { foreignKey: "assignedAgentId", as: "assignedAgent" });

Agent.hasMany(Conversation, { foreignKey: "lockedByAgentId", as: "lockedConversations" });
Conversation.belongsTo(Agent, { foreignKey: "lockedByAgentId", as: "lockedByAgent" });

Conversation.hasMany(Message, { foreignKey: "conversationId", as: "messages" });
Message.belongsTo(Conversation, { foreignKey: "conversationId", as: "conversation" });

ClosedConversation.hasMany(ClosedMessage, { foreignKey: "closedConversationId", as: "messages" });
ClosedMessage.belongsTo(ClosedConversation, { foreignKey: "closedConversationId", as: "closedConversation" });

Feedback.belongsTo(Customer, { foreignKey: "customerId", as: "customer" });
Feedback.belongsTo(Agent, { foreignKey: "agentId", as: "agent" });

import { AgentKpi } from "./AgentKpi.js";
Agent.hasOne(AgentKpi, { foreignKey: "agentId", as: "kpiTargets" });
AgentKpi.belongsTo(Agent, { foreignKey: "agentId", as: "agent" });

import { AgentAttendance } from "./AgentAttendance.js";
import { AgentAttendancePing } from "./AgentAttendancePing.js";
Agent.hasMany(AgentAttendance, { foreignKey: "agentId", as: "attendanceLogs" });
AgentAttendance.belongsTo(Agent, { foreignKey: "agentId", as: "agent" });
AgentAttendance.hasMany(AgentAttendancePing, { foreignKey: "attendanceId", as: "pings" });
AgentAttendancePing.belongsTo(AgentAttendance, { foreignKey: "attendanceId", as: "attendance" });
