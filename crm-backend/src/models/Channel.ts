import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/database.js";

export type ChannelType = "whatsapp" | "facebook" | "instagram" | "twitter" | "widget";

export interface ChannelAttributes {
  id: number;
  type: ChannelType;
  name: string;
  siteId: number | null;
  isConnected: boolean;
  accessToken: string | null;
  phoneNumberId: string | null;
  wabaId: string | null;
  pageId: string | null;
  pageAccessToken: string | null;
  webhookVerifyToken: string;
  instagramAccountId: string | null;
  twitterApiKey: string | null;
  twitterApiSecret: string | null;
  twitterBearerToken: string | null;
  twitterAccessToken: string | null;
  twitterAccessTokenSecret: string | null;
  metadata: Record<string, unknown> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ChannelCreationAttributes
  extends Optional<ChannelAttributes, "id" | "siteId" | "isConnected" | "accessToken" | "phoneNumberId" | "wabaId" | "pageId" | "pageAccessToken" | "instagramAccountId" | "twitterApiKey" | "twitterApiSecret" | "twitterBearerToken" | "twitterAccessToken" | "twitterAccessTokenSecret" | "metadata"> {}

export class Channel extends Model<ChannelAttributes, ChannelCreationAttributes> implements ChannelAttributes {
  declare id: number;
  declare type: ChannelType;
  declare name: string;
  declare siteId: number | null;
  declare isConnected: boolean;
  declare accessToken: string | null;
  declare phoneNumberId: string | null;
  declare wabaId: string | null;
  declare pageId: string | null;
  declare pageAccessToken: string | null;
  declare webhookVerifyToken: string;
  declare instagramAccountId: string | null;
  declare twitterApiKey: string | null;
  declare twitterApiSecret: string | null;
  declare twitterBearerToken: string | null;
  declare twitterAccessToken: string | null;
  declare twitterAccessTokenSecret: string | null;
  declare metadata: Record<string, unknown> | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Channel.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    type: { type: DataTypes.STRING(50), allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false },
    siteId: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null, field: "site_id" },
    isConnected: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "is_connected" },
    accessToken: { type: DataTypes.TEXT, allowNull: true, field: "access_token" },
    phoneNumberId: { type: DataTypes.STRING(100), allowNull: true, field: "phone_number_id" },
    wabaId: { type: DataTypes.STRING(100), allowNull: true, field: "waba_id" },
    pageId: { type: DataTypes.STRING(100), allowNull: true, field: "page_id" },
    pageAccessToken: { type: DataTypes.TEXT, allowNull: true, field: "page_access_token" },
    webhookVerifyToken: { type: DataTypes.STRING(100), allowNull: false, field: "webhook_verify_token", defaultValue: () => Math.random().toString(36).substring(2, 18) },
    instagramAccountId: { type: DataTypes.STRING(100), allowNull: true, field: "instagram_account_id" },
    twitterApiKey: { type: DataTypes.STRING(200), allowNull: true, field: "twitter_api_key" },
    twitterApiSecret: { type: DataTypes.TEXT, allowNull: true, field: "twitter_api_secret" },
    twitterBearerToken: { type: DataTypes.TEXT, allowNull: true, field: "twitter_bearer_token" },
    twitterAccessToken: { type: DataTypes.TEXT, allowNull: true, field: "twitter_access_token" },
    twitterAccessTokenSecret: { type: DataTypes.TEXT, allowNull: true, field: "twitter_access_token_secret" },
    metadata: { type: DataTypes.JSONB, allowNull: true },
  },
  {
    sequelize,
    tableName: "crm_channels",
    underscored: true,
  }
);
