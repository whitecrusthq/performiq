export { Agent } from "./Agent.js";
export { Customer } from "./Customer.js";
export { Conversation } from "./Conversation.js";
export { Message } from "./Message.js";
export { Campaign } from "./Campaign.js";
export { Channel } from "./Channel.js";

import { Agent } from "./Agent.js";
import { Customer } from "./Customer.js";
import { Conversation } from "./Conversation.js";
import { Message } from "./Message.js";
import { Channel } from "./Channel.js";

Customer.hasMany(Conversation, { foreignKey: "customerId", as: "conversations" });
Conversation.belongsTo(Customer, { foreignKey: "customerId", as: "customer" });

Agent.hasMany(Conversation, { foreignKey: "assignedAgentId", as: "conversations" });
Conversation.belongsTo(Agent, { foreignKey: "assignedAgentId", as: "assignedAgent" });

Conversation.hasMany(Message, { foreignKey: "conversationId", as: "messages" });
Message.belongsTo(Conversation, { foreignKey: "conversationId", as: "conversation" });
