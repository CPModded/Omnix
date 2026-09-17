import mongoose, { Schema, Document } from 'mongoose';

export interface IBuildSnapshotChannel {
  sourceId: string;
  name: string;
  type: number;
  parentSourceId: string | null;
  position: number;
  topic?: string | null;
  nsfw?: boolean;
  rateLimitPerUser?: number;
  bitrate?: number;
  userLimit?: number;
  permissionOverwrites: Array<{
    id: string;
    name: string | null;
    allow: string;
    deny: string;
  }>;
}

export interface IBuildSnapshotRole {
  sourceId: string;
  name: string;
  color: number;
  hoist: boolean;
  mentionable: boolean;
  position: number;
  managed: boolean;
}

export interface IBuildSnapshot extends Document {
  ownerId: string;
  sourceGuildId: string;
  sourceGuildName: string;
  createdAt: Date;
  includeStaff: boolean;
  roles: IBuildSnapshotRole[];
  channels: IBuildSnapshotChannel[];
}

const ChannelSchema = new Schema<IBuildSnapshotChannel>({
  sourceId: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: Number, required: true },
  parentSourceId: { type: String, default: null },
  position: { type: Number, default: 0 },
  topic: { type: String, default: null },
  nsfw: { type: Boolean, default: false },
  rateLimitPerUser: { type: Number, default: 0 },
  bitrate: { type: Number },
  userLimit: { type: Number },
  permissionOverwrites: [{
    id: String,
    allow: String,
    deny: String,
  }],
}, { _id: false });

const RoleSchema = new Schema<IBuildSnapshotRole>({
  sourceId: String,
  name: String,
  color: Number,
  hoist: Boolean,
  mentionable: Boolean,
  position: Number,
  managed: Boolean,
}, { _id: false });

const BuildSnapshotSchema = new Schema<IBuildSnapshot>({
  ownerId: { type: String, required: true, index: true },
  sourceGuildId: { type: String, required: true },
  sourceGuildName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, index: true },
  includeStaff: { type: Boolean, default: false },
  roles: { type: [RoleSchema], default: [] },
  channels: { type: [ChannelSchema], default: [] },
});

export default mongoose.models.BuildSnapshot || mongoose.model<IBuildSnapshot>('BuildSnapshot', BuildSnapshotSchema);
